import {
  BaseMessageOptions,
  CommandInteraction,
  InteractionReplyOptions,
  Message,
  PermissionFlagsBits,
  Role,
  ThreadChannel,
} from "discord.js";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { CustomEmbed, ErrorEmbed } from "../models/EmbedBuilders.js";
import { getExactMember } from "../utils/functions/member";
import { newCase } from "../utils/functions/moderation/cases";
import { deleteMute, getMuteRole, isMuted, newMute } from "../utils/functions/moderation/mute";
import { createProfile, profileExists } from "../utils/functions/moderation/utils";
import ms = require("ms");
import dayjs = require("dayjs");

const cmd = new Command("mute", "mute one or more users", "moderation").setPermissions([
  "MANAGE_MESSAGES",
  "MODERATE_MEMBERS",
]);

cmd.slashEnabled = true;
cmd.slashData
  .addUserOption((option) => option.setName("user").setDescription("user to mute").setRequired(true))
  .addStringOption((option) => option.setName("reason").setDescription("reason for the mute"));

async function run(message: Message | (NypsiCommandInteraction & CommandInteraction), args: string[]) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return;
    }
  }

  if (!(await profileExists(message.guild))) await createProfile(message.guild);

  const send = async (data: BaseMessageOptions | InteractionReplyOptions) => {
    if (!(message instanceof Message)) {
      let usedNewMessage = false;
      let res;

      if (message.deferred) {
        res = await message.editReply(data).catch(async () => {
          usedNewMessage = true;
          return await message.channel.send(data as BaseMessageOptions);
        });
      } else {
        res = await message.reply(data as InteractionReplyOptions).catch(() => {
          return message.editReply(data).catch(async () => {
            usedNewMessage = true;
            return await message.channel.send(data as BaseMessageOptions);
          });
        });
      }

      if (usedNewMessage && res instanceof Message) return res;

      const replyMsg = await message.fetchReply();
      if (replyMsg instanceof Message) {
        return replyMsg;
      }
    } else {
      return await message.channel.send(data as BaseMessageOptions);
    }
  };

  if (
    !message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles) ||
    !message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)
  ) {
    return send({
      embeds: [new ErrorEmbed("i need the `manage roles` and `manage channels` permission for this command to work")],
    });
  }

  if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return send({
      embeds: [new ErrorEmbed("i need the `moderate members` permission for this command to work")],
    });
  }

  if (args.length == 0 || !args[0]) {
    const embed = new CustomEmbed(message.member)
      .setHeader("mute help")
      .addField("usage", "/mute <user> (time) (reason) [-s]")
      .addField("help", "if the mute role isnt setup correctly this wont work")
      .addField("time format examples", "**1d** *1 day*\n**10h** *10 hours*\n**15m** *15 minutes*\n**30s** *30 seconds*");
    return send({ embeds: [embed] });
  }

  const target = await getExactMember(message.guild, args[0]);
  let reason = "";

  if (args.length > 1) {
    reason = args.slice(1).join(" ");
  }

  let mode = "role";

  const guildMuteRole = await getMuteRole(message.guild);

  let muteRole: Role;

  if (!guildMuteRole || guildMuteRole == "default") {
    muteRole = message.guild.roles.cache.find((r) => r.name.toLowerCase() == "muted");

    if (!muteRole) {
      let channelError = false;
      try {
        const newMuteRole = await message.guild.roles
          .create({
            name: "muted",
          })
          .catch(() => {
            channelError = true;
          });

        if (newMuteRole instanceof Role) {
          muteRole = newMuteRole;
        }

        message.guild.channels.cache.forEach(async (channel) => {
          if (channel instanceof ThreadChannel) return;
          await channel.permissionOverwrites
            .edit(muteRole, {
              SendMessages: false,
              Speak: false,
              AddReactions: false,
              SendMessagesInThreads: false,
              CreatePublicThreads: false,
              CreatePrivateThreads: false,
            })
            .catch(() => {
              channelError = true;
            });
        });
      } catch (e) {
        return send({
          embeds: [
            new ErrorEmbed("error creating mute role - make sure i have `manage roles` permission and `manage channels`"),
          ],
        });
      }
      if (channelError) {
        return send({
          embeds: [
            new ErrorEmbed("error creating mute role - make sure i have `manage roles` permission and `manage channels`"),
          ],
        });
      }
    }
  } else if (guildMuteRole == "timeout") {
    mode = "timeout";
  } else {
    muteRole = await message.guild.roles.fetch(guildMuteRole);

    if (!muteRole) {
      return send({ embeds: [new ErrorEmbed(`failed to find muterole: ${guildMuteRole}`)] });
    }
  }

  let timedMute = false;
  let unmuteDate: Date;
  let time = 0;

  if (reason != "") {
    time = getDuration(reason.split(" ")[0].toLowerCase());
    unmuteDate = new Date(Date.now() + time * 1000);

    if (time) {
      timedMute = true;
      reason = reason.split(" ").slice(1).join(" ");
    }
  }

  if (mode == "timeout" && !timedMute) {
    unmuteDate = dayjs().add(1, "week").toDate();
    time = ms("1 week") / 1000;

    timedMute = true;
  }

  let fail = false;

  if (mode == "role") {
    if (target.user.id == message.client.user.id) {
      await message.channel.send({ content: "you'll never shut me up 😏" });
      return;
    }

    const targetHighestRole = target.roles.highest;
    const memberHighestRole = message.member.roles.highest;

    if (targetHighestRole.position >= memberHighestRole.position && message.guild.ownerId != message.member.user.id) {
      return send({ embeds: [new ErrorEmbed(`your role is not high enough to punish ${target.toString()}`)] });
    } else {
      await target.roles.add(muteRole).catch(() => {
        fail = true;

        return send({
          embeds: [new ErrorEmbed("i am unable to give users the mute role - ensure my role is above the 'muted' role")],
        });
      });
    }
    if (fail) return;
  } else if (mode == "timeout") {
    if (target.user.id == message.client.user.id) {
      return await message.channel.send({ content: "youll never shut me up 😏" });
    }

    const targetHighestRole = target.roles.highest;
    const memberHighestRole = message.member.roles.highest;

    if (targetHighestRole.position >= memberHighestRole.position && message.guild.ownerId != message.member.user.id) {
      return send({ embeds: [new ErrorEmbed(`your role is not high enough to punish ${target.toString()}`)] });
    } else if (target.isCommunicationDisabled() as boolean) {
      return send({ embeds: [new ErrorEmbed(`${target.user.toString()} is already timed out`)] });
    } else {
      await target.disableCommunicationUntil(unmuteDate, reason).catch(() => {
        fail = true;
        return send({
          embeds: [new ErrorEmbed("i am unable to timeout users, ensure my role is high enough and i have the permission")],
        });
      });
    }
    if (fail) return;
  }

  if (fail) return;

  let mutedLength = "";

  if (timedMute) {
    mutedLength = getTime(time * 1000);
  }

  const embed = new CustomEmbed(message.member);

  let msg = `✅ \`${target.user.tag}\` has been muted`;

  if (timedMute) {
    msg += ` for **${mutedLength}**`;
  } else if (reason) {
    msg += ` for **${reason}**`;
  }

  embed.setDescription(msg);

  if (args.join(" ").includes("-s")) {
    if (message instanceof Message) {
      await message.delete();
      await message.member.send({ embeds: [embed] }).catch(() => {});
    } else {
      await message.reply({ embeds: [embed], ephemeral: true });
    }
  } else {
    await send({ embeds: [embed] });
  }

  let storeReason = reason;

  if (!timedMute) {
    storeReason = "[perm] " + reason;
  } else {
    storeReason = `[${mutedLength}] ${reason}`;
  }

  await newCase(message.guild, "mute", target.user.id, message.author.tag, storeReason);

  if (await isMuted(message.guild, target)) {
    await deleteMute(message.guild, target);
  }

  if (timedMute && mode !== "timeout") {
    await newMute(message.guild, [target.user.id], unmuteDate);
  }

  if (!timedMute && mode !== "timeout") {
    await newMute(message.guild, [target.user.id], new Date(3130000000000));
  }

  if (args.join(" ").includes("-s")) return;
  if (!timedMute) {
    const embed = new CustomEmbed(target).setTitle(`muted in ${message.guild.name}`).addField("length", "`permanent`", true);

    if (reason != "") {
      embed.addField("reason", `\`${reason}\``, true);
    }

    await target.send({ content: `you have been muted in ${message.guild.name}`, embeds: [embed] }).catch(() => {});
  } else {
    const embed = new CustomEmbed(target)
      .setTitle(`muted in ${message.guild.name}`)
      .addField("length", `\`${mutedLength}\``, true)
      .setFooter({ text: "unmuted at:" })
      .setTimestamp(unmuteDate);

    if (reason != "") {
      embed.addField("reason", `\`${reason}\``, true);
    }

    await target.send({ content: `you have been muted in ${message.guild.name}`, embeds: [embed] }).catch(() => {});
  }
}

cmd.setRun(run);

module.exports = cmd;

function getDuration(duration: string): number {
  duration.toLowerCase();

  if (duration.includes("d")) {
    if (!parseInt(duration.split("d")[0])) return undefined;

    const num = parseInt(duration.split("d")[0]);

    return num * 86400;
  } else if (duration.includes("h")) {
    if (!parseInt(duration.split("h")[0])) return undefined;

    const num = parseInt(duration.split("h")[0]);

    return num * 3600;
  } else if (duration.includes("m")) {
    if (!parseInt(duration.split("m")[0])) return undefined;

    const num = parseInt(duration.split("m")[0]);

    return num * 60;
  } else if (duration.includes("s")) {
    if (!parseInt(duration.split("s")[0])) return undefined;

    const num = parseInt(duration.split("s")[0]);

    return num;
  }
}

function getTime(ms: number) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const daysms = ms % (24 * 60 * 60 * 1000);
  const hours = Math.floor(daysms / (60 * 60 * 1000));
  const hoursms = ms % (60 * 60 * 1000);
  const minutes = Math.floor(hoursms / (60 * 1000));
  const minutesms = ms % (60 * 1000);
  const sec = Math.floor(minutesms / 1000);

  let output = "";

  if (days > 0) {
    let a = " days";

    if (days == 1) {
      a = " day";
    }

    output = days + a;
  }

  if (hours > 0) {
    let a = " hours";

    if (hours == 1) {
      a = " hour";
    }

    if (output == "") {
      output = hours + a;
    } else {
      output = `${output} ${hours}${a}`;
    }
  }

  if (minutes > 0) {
    let a = " mins";

    if (minutes == 1) {
      a = " min";
    }

    if (output == "") {
      output = minutes + a;
    } else {
      output = `${output} ${minutes}${a}`;
    }
  }

  if (sec > 0) {
    output = output + sec + "s";
  }

  return output;
}
