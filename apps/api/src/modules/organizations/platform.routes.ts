import { Router } from 'express';
import { z } from 'zod';
import { requirePasswordChanged, requireRole } from '../../middleware/auth.js';
import { asyncHandler, objectId, routeParam } from '../../utils/http.js';
import { sendSuccess } from '../../utils/responses.js';
import { ApiError } from '../../utils/api-error.js';
import type { AuditService } from '../alerts/audit.service.js';
import { paginationSchema, passwordSchema, usernameSchema } from '../auth/auth.schemas.js';
import type { AuthService } from '../auth/auth.service.js';
import type { PasswordService } from '../auth/password.service.js';
import { UserModel, safeUser, userStatuses, type UserDocument } from '../users/user.model.js';
import { OrganizationModel, organizationStatuses } from './organization.model.js';

const organizationCreate = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2)
      .max(32)
      .regex(/^[A-Z0-9_-]+$/),
    contactName: z.string().trim().max(120).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().trim().max(32).optional(),
  })
  .strict();
const organizationUpdate = organizationCreate
  .omit({ code: true })
  .partial()
  .extend({ status: z.enum(organizationStatuses).optional() })
  .strict();
const adminCreate = z
  .object({
    username: usernameSchema,
    displayName: z.string().trim().min(2).max(120),
    email: z.string().email().optional(),
    temporaryPassword: passwordSchema,
  })
  .strict();
const statusUpdate = z.object({ status: z.enum(userStatuses) }).strict();

export const createPlatformRouter = (
  passwords: PasswordService,
  auth: AuthService,
  audit: AuditService,
): Router => {
  const router = Router();
  router.use(requireRole('PLATFORM_ADMIN'), requirePasswordChanged);
  router.post(
    '/organizations',
    asyncHandler(async (req, res) => {
      const body = organizationCreate.parse(req.body);
      const organization = await OrganizationModel.create({
        ...body,
        createdBy: req.authUser!._id,
      });
      await audit.record({
        actorId: req.authUser!._id,
        action: 'ORGANIZATION_CREATED',
        targetType: 'Organization',
        targetId: organization.id,
        organizationId: organization._id,
      });
      return sendSuccess(res, 201, { organization });
    }),
  );
  router.get(
    '/organizations',
    asyncHandler(async (req, res) => {
      const { page, limit } = paginationSchema.parse(req.query);
      const [items, total] = await Promise.all([
        OrganizationModel.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        OrganizationModel.countDocuments(),
      ]);
      return sendSuccess(res, 200, { items, pagination: { page, limit, total } });
    }),
  );
  router.get(
    '/organizations/:organizationId',
    asyncHandler(async (req, res) => {
      const item = await OrganizationModel.findById(
        objectId(routeParam(req, 'organizationId'), 'organizationId'),
      ).lean();
      if (!item) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
      return sendSuccess(res, 200, { organization: item });
    }),
  );
  router.patch(
    '/organizations/:organizationId',
    asyncHandler(async (req, res) => {
      const id = objectId(routeParam(req, 'organizationId'), 'organizationId');
      const body = organizationUpdate.parse(req.body);
      const item = await OrganizationModel.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true, runValidators: true },
      );
      if (!item) throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found');
      if (body.status && body.status !== 'ACTIVE') {
        await UserModel.updateMany({ organizationId: id }, { status: 'SUSPENDED' });
        await Promise.all(
          (await UserModel.find({ organizationId: id }).select('_id')).map((u) =>
            auth.revokeAll(u._id),
          ),
        );
      }
      await audit.record({
        actorId: req.authUser!._id,
        action: 'ORGANIZATION_UPDATED',
        targetType: 'Organization',
        targetId: item.id,
        organizationId: item._id,
        metadata: { fields: Object.keys(body) },
      });
      return sendSuccess(res, 200, { organization: item });
    }),
  );
  router.post(
    '/organizations/:organizationId/admins',
    asyncHandler(async (req, res) => {
      const organizationId = objectId(routeParam(req, 'organizationId'), 'organizationId');
      const organization = await OrganizationModel.findOne({
        _id: organizationId,
        status: 'ACTIVE',
      });
      if (!organization)
        throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'Organization is unavailable');
      const body = adminCreate.parse(req.body);
      const user = await UserModel.create({
        organizationId,
        username: body.username,
        displayName: body.displayName,
        email: body.email,
        passwordHash: await passwords.hash(body.temporaryPassword),
        role: 'INSTALLER_ADMIN',
        status: 'ACTIVE',
        mustChangePassword: true,
        passwordChangedAt: new Date(),
        createdBy: req.authUser!._id,
      });
      await audit.record({
        actorId: req.authUser!._id,
        action: 'INSTALLER_ADMIN_CREATED',
        targetType: 'User',
        targetId: user.id,
        organizationId,
      });
      return sendSuccess(res, 201, { user: safeUser(user) });
    }),
  );
  router.get(
    '/organizations/:organizationId/admins',
    asyncHandler(async (req, res) => {
      const organizationId = objectId(routeParam(req, 'organizationId'), 'organizationId');
      const { page, limit } = paginationSchema.parse(req.query);
      const filter = { organizationId, role: 'INSTALLER_ADMIN' as const };
      const [users, total] = await Promise.all([
        UserModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        UserModel.countDocuments(filter),
      ]);
      return sendSuccess(res, 200, {
        items: users.map((user) => safeUser(user as UserDocument)),
        pagination: { page, limit, total },
      });
    }),
  );
  router.patch(
    '/users/:userId/status',
    asyncHandler(async (req, res) => {
      const id = objectId(routeParam(req, 'userId'), 'userId');
      const body = statusUpdate.parse(req.body);
      const user = await UserModel.findOneAndUpdate(
        { _id: id, role: { $ne: 'PLATFORM_ADMIN' } },
        { status: body.status },
        { new: true, runValidators: true },
      );
      if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
      if (body.status !== 'ACTIVE') await auth.revokeAll(user._id);
      await audit.record({
        actorId: req.authUser!._id,
        action: 'USER_STATUS_CHANGED',
        targetType: 'User',
        targetId: user.id,
        organizationId: user.organizationId,
        metadata: { status: body.status },
      });
      return sendSuccess(res, 200, { user: safeUser(user) });
    }),
  );
  return router;
};
