import { create } from "zustand";
import { userServiceClient } from "@/grpcweb";
import { User } from "@/types/proto/api/v2/user_service";
import { UserNamePrefix, extractUsernameFromName } from "./resourceName";

interface UserV1Store {
  userMapByUsername: Record<string, User>;
  getOrFetchUserByUsername: (username: string) => Promise<User>;
  getUserByUsername: (username: string) => User;
  updateUser: (user: Partial<User>, updateMask: string[]) => Promise<User>;
}

// Request cache is used to prevent multiple requests.
const requestCache = new Map<string, Promise<any>>();

export const useUserV1Store = create<UserV1Store>()((set, get) => ({
  userMapByUsername: {},
  getOrFetchUserByUsername: async (username: string) => {
    const userMap = get().userMapByUsername;
    if (userMap[username]) {
      return userMap[username] as User;
    }
    if (requestCache.has(username)) {
      return await requestCache.get(username);
    }

    const promisedUser = userServiceClient
      .getUser({
        name: `${UserNamePrefix}${username}`,
      })
      .then(({ user }) => user);
    requestCache.set(username, promisedUser);
    const user = await promisedUser;
    if (!user) {
      throw new Error("User not found");
    }
    requestCache.delete(username);
    userMap[username] = user;
    set(userMap);
    return user;
  },
  getUserByUsername: (username: string) => {
    const userMap = get().userMapByUsername;
    return userMap[username];
  },
  updateUser: async (user: Partial<User>, updateMask: string[]) => {
    const { user: updatedUser } = await userServiceClient.updateUser({
      user: user,
      updateMask: updateMask,
    });
    if (!updatedUser) {
      throw new Error("User not found");
    }
    const username = extractUsernameFromName(updatedUser.name);
    const userMap = get().userMapByUsername;
    userMap[username] = updatedUser;
    set(userMap);
    return updatedUser;
  },
}));
