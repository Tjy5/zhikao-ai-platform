export interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
}

export interface AuthLoginPayload {
  username_or_email: string;
  password: string;
}

export interface AuthRegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
