import { CommandInteraction, Message } from "discord.js";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { CustomEmbed } from "../models/EmbedBuilders.js";
import { getBalance, updateBalance } from "../utils/functions/economy/balance";
import { createUser, userExists } from "../utils/functions/economy/utils";
import { getTier, isPremium } from "../utils/functions/premium/premium";
import { addCooldown, getResponse, onCooldown } from "../utils/handlers/cooldownhandler.js";
import ms = require("ms");

const cmd = new Command("freemoney", "get some free money", "money").setAliases(["poor", "imbroke"]);

async function run(message: Message | (NypsiCommandInteraction & CommandInteraction)) {
  if (await onCooldown(cmd.name, message.member)) {
    const embed = await getResponse(cmd.name, message.member);

    return message.channel.send({ embeds: [embed] });
  }

  if (!(await userExists(message.member))) await createUser(message.member);

  await addCooldown(cmd.name, message.member, ms("30 minutes") / 1000);

  let amount = 1000;

  if (await isPremium(message.author.id)) {
    if ((await getTier(message.author.id)) == 1) {
      amount = 2500;
    } else if ((await getTier(message.author.id)) == 2) {
      amount = 5000;
    } else if ((await getTier(message.author.id)) == 3) {
      amount = 7500;
    } else if ((await getTier(message.author.id)) == 4) {
      amount = 10000;
    }
  }

  await updateBalance(message.member, (await getBalance(message.member)) + amount);

  const embed = new CustomEmbed(message.member, `+$**${amount.toLocaleString()}**`).setHeader(
    "free money",
    message.author.avatarURL()
  );

  message.channel.send({ embeds: [embed] }).then(async (msg) => {
    embed.setDescription(
      `+$**${amount.toLocaleString()}**\nnew balance: $**${(await getBalance(message.member)).toLocaleString()}**`
    );
    setTimeout(() => {
      msg.edit({ embeds: [embed] });
    }, 1000);
  });
}

cmd.setRun(run);

module.exports = cmd;
