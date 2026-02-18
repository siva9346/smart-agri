export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
  error: string | null;
}
