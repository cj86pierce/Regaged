import { isAdminUsername, isOwnerUsername } from "@/lib/usernames";

export type StaffFlags = {
  isOwner: boolean;
  isAdmin: boolean;
  usernameLower: string;
};

export function resolveStaffFlags(user: StaffFlags): {
  isOwner: boolean;
  isAdmin: boolean;
  isStaff: boolean;
} {
  const isOwner = user.isOwner || isOwnerUsername(user.usernameLower);
  // Owner accounts are not shown as Admin; Admin is a separate badge/role.
  const isAdmin = !isOwner && (user.isAdmin || isAdminUsername(user.usernameLower));
  return { isOwner, isAdmin, isStaff: isOwner || isAdmin };
}
