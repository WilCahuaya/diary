export function memberCanWrite(isOwner: boolean, guestCanWrite: boolean): boolean {
  return isOwner || guestCanWrite;
}
