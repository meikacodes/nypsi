import { Collection, Guild, GuildMember, Role } from "discord.js";
import Constants from "../Constants";
import chooseMember from "./workers/choosemember";

export async function getMember(guild: Guild, memberName: string): Promise<GuildMember> {
  if (!guild) return null;

  if (memberName.match(Constants.MENTION_REGEX)) {
    return (await guild.members.fetch(memberName.replaceAll(/\D/g, ""))) || null;
  }

  let members: Collection<string, GuildMember>;

  if (guild.memberCount == guild.members.cache.size && guild.memberCount <= 25) {
    members = guild.members.cache;
  } else {
    members = await guild.members.fetch();
  }

  let target: GuildMember;
  const possible = new Map<number, GuildMember>();

  if (members.size > 1000) {
    const id = await chooseMember(members, memberName);
    target = members.get(id);
  } else {
    for (const m of members.keys()) {
      const member = members.get(m);

      if (member.user.id == memberName) {
        target = member;
        break;
      } else if (member.user.tag.toLowerCase() == memberName.toLowerCase()) {
        target = member;
        break;
      } else if (member.user.username.toLowerCase() == memberName.toLowerCase()) {
        if (member.user.bot) {
          possible.set(3, member);
        } else {
          target = member;
          break;
        }
      } else if (member.displayName.toLowerCase() == memberName.toLowerCase()) {
        if (member.user.bot) {
          possible.set(4, member);
        } else {
          possible.set(1, member);
        }
      } else if (member.user.tag.toLowerCase().includes(memberName.toLowerCase())) {
        if (member.user.bot) {
          possible.set(5, member);
        } else {
          possible.set(2, member);
        }
      } else if (member.displayName.toLowerCase().includes(memberName.toLowerCase())) {
        if (member.user.bot) {
          possible.set(6, member);
        } else {
          possible.set(3, member);
        }
      }

      if (possible.size == 6) break;
    }

    if (!target) {
      if (possible.get(1)) {
        target = possible.get(1);
      } else if (possible.get(2)) {
        target = possible.get(2);
      } else if (possible.get(3)) {
        target = possible.get(3);
      } else if (possible.get(4)) {
        target = possible.get(4);
      } else if (possible.get(5)) {
        target = possible.get(5);
      } else if (possible.get(6)) {
        target = possible.get(6);
      } else {
        target = null;
      }
    }
  }

  return target;
}

export async function getExactMember(guild: Guild, memberName: string): Promise<GuildMember> {
  if (!guild) return null;

  if (memberName.match(Constants.MENTION_REGEX)) {
    return (await guild.members.fetch(memberName.replaceAll(/\D/g, ""))) || null;
  }

  let members: Collection<string, GuildMember>;

  if (guild.memberCount == guild.members.cache.size && guild.memberCount <= 25) {
    members = guild.members.cache;
  } else {
    members = await guild.members.fetch();
  }

  const target = members.find(
    (member) =>
      member.user.username.toLowerCase() == memberName.toLowerCase() ||
      member.user.tag.toLowerCase() == memberName.toLowerCase() ||
      member.user.id == memberName
  );

  return target;
}

export async function getRole(guild: Guild, roleName: string): Promise<Role> {
  if (!guild) return null;

  const roles = await guild.roles.fetch();

  let target: Role;
  const possible = new Map<number, Role>();

  for (const m of roles.keys()) {
    const role = roles.get(m);

    if (role.id == roleName) {
      target = role;
      break;
    } else if (role.name.toLowerCase() == roleName.toLowerCase()) {
      target = role;
      break;
    } else if (role.name.toLowerCase().includes(roleName.toLowerCase())) {
      possible.set(3, role);
    }
  }

  if (!target) {
    if (possible.get(1)) {
      target = possible.get(1);
    } else if (possible.get(2)) {
      target = possible.get(2);
    } else if (possible.get(3)) {
      target = possible.get(3);
    } else if (possible.get(4)) {
      target = possible.get(4);
    } else if (possible.get(5)) {
      target = possible.get(5);
    } else if (possible.get(6)) {
      target = possible.get(6);
    } else {
      target = null;
    }
  }

  return target;
}
