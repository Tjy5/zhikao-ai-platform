// Validation utility functions

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUsername(username: string): boolean {
  // Allow letters, numbers, underscores, hyphens
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  return username.length >= 3 && username.length <= 30 && usernameRegex.test(username);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

export function trim(value: string): string {
  return value.trim();
}

export function toLowerCase(value: string): string {
  return value.toLowerCase();
}
