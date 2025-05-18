
export interface RegisterFormValues {
  username: string;
  password: string;
  phone_number: string;
  school?: string;
  department?: string;
  major?: string;
  grade?: string;
}

export interface LoginFormValues {
  username: string;
  password: string;
}
