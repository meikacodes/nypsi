const fs = require("fs");
let guilds = JSON.parse(fs.readFileSync("./guilds/data.json"));

let timer = 0
let timerCheck = true
setInterval(() => {
    const guilds1 = JSON.parse(fs.readFileSync("./guilds/data.json"))

    if (JSON.stringify(guilds) != JSON.stringify(guilds1)) {

        fs.writeFile("./guilds/data.json", JSON.stringify(guilds), (err) => {
            if (err) {
                return console.log(err);
            }
            console.log("\x1b[32m[" + getTimestamp() + "] guilds saved\x1b[37m")
        })

        timer = 0
        timerCheck = false
    } else if (!timerCheck) {
        timer++
    }

    if (timer >= 10 && !timerCheck) {
        guilds = JSON.parse(fs.readFileSync("./guilds/data.json"));
        console.log("\x1b[32m[" + getTimestamp() + "] guild data refreshed\x1b[37m")
        timerCheck = true
        timer = 0
    }
}, 120000)

setInterval(async () => {
    const { snipe, eSnipe } = require("../nypsi")

    const now = new Date().getTime()

    let snipeCount = 0
    let eSnipeCount = 0

    await snipe.forEach(msg => {
        const diff = now - msg.createdTimestamp

        if (diff >= 86400000) {
            snipe.delete(msg.channel.id)
            snipeCount++
        }
    })

    if (snipeCount > 0) {
        console.log("[" + getTimestamp() + "] deleted " + snipeCount.toLocaleString() + " sniped messages")
    }

    await eSnipe.forEach(msg => {
        const diff = now - msg.createdTimestamp

        if (diff >= 86400000) {
            eSnipe.delete(msg.channel.id)
            eSnipeCount++
        }
    })

    if (eSnipeCount > 0) {
        console.log("[" + getTimestamp() + "] deleted " + eSnipeCount.toLocaleString() + " edit sniped messages")
    }

}, 3600000)

const fetchCooldown = new Set()
const checkCooldown = new Set()

module.exports = {
    /**
     * 
     * @param {*} guild run check for guild
     */
    runCheck: async function(guild) {

        if (checkCooldown.has(guild.id)) return

        checkCooldown.add(guild.id)

        setTimeout(() => {
            checkCooldown.delete(guild.id)
        }, 60 * 1000);

        if (!hasGuild1(guild)) createGuild1(guild)

        const currentMembersPeak = guilds[guild.id].members
        const currentOnlinesPeak = guilds[guild.id].onlines

        let members

        if (fetchCooldown.has(guild.id) || guild.memberCount == guild.members.cache.size || guild.memberCount <= 250 || guild.memberCount >= 25000) {
            members = guild.members.cache
        } else {
            members = await guild.members.fetch()
            
            fetchCooldown.add(guild.id)

            setTimeout(() => {
                fetchCooldown.delete(guild.id)
            }, 3600 * 1000);
        }

        const currentMembers = members.filter(member => !member.user.bot)
        const currentOnlines = currentMembers.filter(member => member.presence.status != "offline")

        if (currentMembers.size > currentMembersPeak) {
            guilds[guild.id].members = currentMembers.size
            console.log("[" + getTimestamp() + "] members peak updated for '" + guild.name + "' " + currentMembersPeak+ " -> " + currentMembers.size)
        }

        if (currentOnlines.size > currentOnlinesPeak) {
            guilds[guild.id].onlines = currentOnlines.size
            console.log("[" + getTimestamp() + "] online peak updated for '" + guild.name + "' " + currentOnlinesPeak + " -> " + currentOnlines.size)
        }
    },

    /**
     * @returns {boolean}
     * @param {*} guild check if guild is stored
     */
    hasGuild: function(guild) {
        if (guilds[guild.id]) {
            return true
        } else {
            return false
        }
    },

    /**
     * @returns {JSON} members / onlines
     * @param {*} guild guild to get peaks of
     */
    getPeaks: function(guild) {
        return guilds[guild.id]
    },

    /**
     * 
     * @param {*} guild create guild profile
     */
    createGuild: function(guild) {
        const members = guild.members.cache.filter(member => !member.user.bot)
        const onlines = members.filter(member => member.presence.status != "offline")

        guilds[guild.id] = {
            members: members.size,
            onlines: onlines.size,
            snipeFilter: ["discord.gg", "/invite/"],
            stats: {
                enabled: false,
                format: "members: %count% (%peak%)",
                filterBots: true,
                channel: "none"
            },
            prefix: "$"
        }
    },

    /**
     * 
     * @param {*} guild get snipe filter
     * @returns {Array}
     */
    getSnipeFilter: function(guild) {
        return guilds[guild.id].snipeFilter
    },

    /**
     * 
     * @param {*} guild guild to change filter of
     * @param {*} array array to change filter to
     */
    updateFilter: function(guild, array) {
        guilds[guild.id].snipeFilter = array
    },

    /**
     * 
     * @param {*} guild guild to check if stats are enabled
     * @returns {Boolean}
     */
    hasStatsEnabled: function(guild) {
        if (guilds[guild.id].stats.enabled == true) {
            return true
        } else {
            return false
        }
    },

    /**
     * 
     * @param {*} guild guild to check if stats profile exists
     * @returns {Boolean}
     */
    hasStatsProfile: function(guild) {
        if (guilds[guild.id].stats) {
            return true
        } else {
            return false
        }
    },

    /**
     * 
     * @param {*} guild guild to create default stats profile for
     */
    createDefaultStatsProfile: function(guild) {
        guilds[guild.id].stats = {
            enabled: false,
            format: "members: %count% (%peak%)",
            filterBots: true,
            channel: "none"
        }
    },

    /**
     * 
     * @param {*} guild guild to get stats profile of
     * @returns {JSON} profile 
     */
    getStatsProfile: function(guild) {
        return guilds[guild.id].stats
    },

    /**
     * 
     * @param {*} guild guild to set stats profile of
     * @param {JSON} profile profile to set
     */
    setStatsProfile: function(guild, profile) {
        guilds[guild.id].stats = profile
    },

    /**
     * @returns {Array}
     */
    getGuilds: function() {
        const guilds1 = []

        for (g in guilds) {
            guilds1.push(g)
        }
        return guilds1
    },

    /**
     * 
     * @param {*} guild guild to check stats of
     */
    checkStats: async function(guild) {

        let memberCount

        if (fetchCooldown.has(guild.id) || guild.memberCount == guild.members.cache.size || guild.memberCount <= 250 || guild.memberCount >= 25000) {
            memberCount = guild.members.cache
        } else {
            memberCount = await guild.members.fetch()
            
            fetchCooldown.add(guild.id)

            setTimeout(() => {
                fetchCooldown.delete(guild.id)
            }, 3600)
        }

        if (!memberCount) memberCount = guild.members.cache

        const channel = guild.channels.cache.find(c => c.id == guilds[guild.id].stats.channel)

        if (!channel) {
            guilds[guild.id].stats.enabled = false
            guilds[guild.id].stats.channel = "none"
            return
        }

        if (guilds[guild.id].stats.filterBots) {
            memberCount = memberCount.filter(m => !m.user.bot)
        }

        let format = ""

        if (guild.memberCount >= 25000) {
            format = guilds[guild.id].stats.format.split("%count%").join(guild.memberCount.toLocaleString())
            format = format.split("%peak%").join(guilds[guild.id].members)
            guilds[guild.id].stats.filterBots = false
        } else {
            format = guilds[guild.id].stats.format.split("%count%").join(memberCount.size.toLocaleString())
            format = format.split("%peak%").join(guilds[guild.id].members)
        }

        if (channel.name != format) {
            const old = channel.name

            await channel.edit({name: format}).then(() => {
                console.log("[" + getTimestamp() + "] counter updated for '" + guild.name + "' ~ '" + old + "' -> '" + format + "'")
            }).catch(() => {
                console.log("[" + getTimestamp() + "] error updating counter in " + guild.name)
                guilds[guild.id].stats.enabled = false
                guilds[guild.id].stats.channel = "none"
            })
        }
    },

    /**
     * 
     * @param {*} guild guild to add to cooldown
     * @param {*} seconds seconds to remove after
     */
    addCooldown: function(guild, seconds) {
        fetchCooldown.add(guild.id)

        setTimeout(() => {
            fetchCooldown.delete(guild.id)
        }, seconds * 1000)
    },

    /**
     * @returns {Boolean}
     * @param {*} guild guild to check if added to cooldown
     */
    inCooldown: function(guild) {

        if (guild.memberCount <= 250 || guild.memberCount >= 25000) return true

        if (fetchCooldown.has(guild.id)) {
            return true
        } else {
            return false
        }
    },

    /**
     * @returns {String}
     * @param {*} guild guild to get prefi of
     */
    getPrefix: function(guild) {
        try {
            return guilds[guild.id].prefix
        } catch (e) {
            console.log("[" + getTimestamp() + "] couldn't fetch prefix for server " + guild.id)
            return "$"
        }
    },

    /**
     * 
     * @param {*} guild guild to set prefix
     * @param {*} prefix prefix to be used
     */
    setPrefix: function(guild, prefix) {
        guilds[guild.id].prefix = prefix
    }
}

function getTimestamp() {
    const date = new Date();
    let hours = date.getHours().toString();
    let minutes = date.getMinutes().toString();
    let seconds = date.getSeconds().toString();
    
    if (hours.length == 1) {
        hours = "0" + hours;
    } 
    
    if (minutes.length == 1) {
        minutes = "0" + minutes;
    } 
    
    if (seconds.length == 1) {
        seconds = "0" + seconds;
    }
    
    const timestamp = hours + ":" + minutes + ":" + seconds;

    return timestamp
}

function hasGuild1(guild) {
    if (guilds[guild.id]) {
        return true
    } else {
        return false
    }
}

function createGuild1(guild) {
    const members = guild.members.cache.filter(member => !member.user.bot)
    const onlines = members.filter(member => member.presence.status != "offline")

    guilds[guild.id] = {
        members: members.size,
        onlines: onlines.size,
        snipeFilter: ["discord.gg", "/invite/"],
        stats: {
            enabled: false,
            format: "members: %count% (%peak%)",
            filterBots: true,
            channel: "none"
        },
        prefix: "$"
    }
}