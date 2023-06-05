import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageActionRowComponentBuilder } from "discord.js";
import { inPlaceSort } from "fast-sort";
import { CustomEmbed, ErrorEmbed } from "../models/EmbedBuilders";
import { InteractionHandler } from "../types/InteractionHandler";
import Constants from "../utils/Constants";
import { addProgress } from "../utils/functions/economy/achievements";
import { getInventory, openCrate } from "../utils/functions/economy/inventory";
import { getPrestige } from "../utils/functions/economy/prestige";
import { addStat } from "../utils/functions/economy/stats";
import { getItems, isEcoBanned } from "../utils/functions/economy/utils";
import PageManager from "../utils/functions/page";
import { addCooldown, getResponse, onCooldown } from "../utils/handlers/cooldownhandler";

export default {
  name: "vote-crates",
  type: "interaction",
  async run(interaction) {
    if (!interaction.isButton()) return;
    if (await isEcoBanned(interaction.user.id)) return;
    if (await onCooldown("use", interaction.user.id)) {
      const embed = await getResponse("use", interaction.user.id);

      return interaction.reply({ embeds: [embed] });
    }

    await addCooldown("use", interaction.user.id, 7);

    const inventory = await getInventory(interaction.user.id, false);

    const crateAmount =
      Constants.VOTE_CRATE_PROGRESSION[await getPrestige(interaction.user.id)] ||
      Constants.VOTE_CRATE_PROGRESSION[Constants.VOTE_CRATE_PROGRESSION.length - 1];

    if (
      !inventory.find((i) => i.item === "vote_crate") ||
      inventory.find((i) => i.item === "vote_crate")?.amount < crateAmount
    ) {
      return interaction.reply({ embeds: [new ErrorEmbed(`you do not have ${crateAmount} vote crates`)] });
    }

    await interaction.deferReply();

    const embed = new CustomEmbed().setHeader(
      `${interaction.user.username}'s ${crateAmount} vote crate${crateAmount > 1 ? "s" : ""}`,
      interaction.user.avatarURL()
    );

    await Promise.all([
      addProgress(interaction.user.id, "unboxer", crateAmount),
      addStat(interaction.user.id, "vote_crate", crateAmount),
    ]);

    const foundItems = new Map<string, number>();

    for (let i = 0; i < crateAmount; i++) {
      const found = await openCrate(interaction.user.id, getItems()["vote_crate"]);

      for (const [key, value] of found.entries()) {
        if (foundItems.has(key)) {
          foundItems.set(key, foundItems.get(key) + value);
        } else {
          foundItems.set(key, value);
        }
      }
    }

    const desc: string[] = [];

    desc.push("you found: ");

    if (foundItems.has("money")) {
      desc.push(`- $${foundItems.get("money").toLocaleString()}`);
      foundItems.delete("money");
    }

    if (foundItems.has("xp")) {
      embed.setFooter({ text: `+${foundItems.get("xp").toLocaleString()}xp` });
      foundItems.delete("xp");
    }

    for (const [item, amount] of inPlaceSort(Array.from(foundItems.entries())).desc([
      (i) => getItems()[i[0]].rarity,
      (i) => i[1],
    ])) {
      desc.push(`- \`${amount}x\` ${getItems()[item].emoji} ${getItems()[item].name}`);
    }

    const pages = PageManager.createPages(desc, 15);

    embed.setDescription(pages.get(1).join("\n"));

    if (pages.size === 1) {
      return interaction.editReply({ embeds: [embed] });
    } else {
      const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setCustomId("⬅").setLabel("back").setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId("➡").setLabel("next").setStyle(ButtonStyle.Primary)
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const manager = new PageManager({
        embed,
        message: msg,
        row,
        userId: interaction.user.id,
        pages,
      });

      return manager.listen();
    }
  },
} as InteractionHandler;
