/**
 * In the case that loading an existing Zupass user fails,
 * we can determine if it failed because the user does not exist,
 * or due to some other error, such as intermittent network error,
 * or the backend being down.
 */
export type LoadUserError =
  | { userMissing: true; errorMessage?: never }
  | { userMissing?: never; errorMessage: string };

/**
 * When you ask Zupass for a user, it will respond with this type.
 */
export type UserResponseValue = ZupassUserJson;

/**
 * The Zupass server returns this data structure to users
 * to represent Zupass users.
 */
export interface ZupassUserJson {
  uuid: string;
  commitment: string;
  email: string;
  salt: string | null;
  terms_agreed: number;
}
