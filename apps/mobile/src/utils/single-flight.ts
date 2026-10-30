export class SingleFlight<T> {
  private pending: Promise<T> | null = null;
  public run(task: () => Promise<T>): Promise<T> {
    if (this.pending) return this.pending;
    this.pending = task().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
}
