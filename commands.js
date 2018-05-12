let globals = require("./variables.js");
const dateFormat = require("dateformat");
const config = require("./config.json");
const util = require("./util.js");
const Discord = require("discord.js");

function getUserByName(msg, name){
    let member;
    member = msg.mentions.members.first();
    if(!member){
        //Cannot use util.displayname here to allow people with dumb usernames to work
        let users = globals.guild.members.filter(user =>
            user.user.username
                .toLowerCase().includes(name) ||
            (user.nickname || "")
                .toLowerCase().includes(name)
        ).array();

        if(users.length > 1){
            msg.channel.send(`Multiple users with this name, ${users.map(user => util.displayName(user)).join(", ")}`);
            return;
        }else{
            member = users[0];
        }
    }
    if(!member){
        msg.channel.send(`Could not find member by name "${name}"`);
        return;
    }
    return member;
}

function sendRich(channel, text){
    let embed = new Discord.RichEmbed();
    embed.setDescription(text);
    channel.send(embed);
}

async function infometa(msg, f){
    let name = msg.content.split(" ")[1];
    let member = getUserByName(msg, name);

    if(!member) return;

    let gear = globals.geardb[member.id];
    if(!gear){
        sendRich(msg.channel, `Could not find gear for <@!${member.id}>`);
    }else{
        f(member, gear);
    }
}

async function gear(msg){
    return infometa(msg, (member, gear) => {
        let embed = new Discord.RichEmbed();
        embed.setTitle("Gear");
        embed.setDescription(`<@!${member.id}>`);
        embed.addField(`${dateFormat(globals.dateFormat)}`, `${gear.originalLink}`);
        embed.setImage(gear.originalLink);
        msg.channel.send(embed);
    });
}
async function gearbackup(msg){
    return infometa(msg, (member, gear) => {
        let embed = new Discord.RichEmbed();
        embed.setTitle("Gear");
        embed.setDescription(`<@!${member.id}>`);
        embed.addField(`${dateFormat(globals.dateFormat)}`, `${gear.imgurLink}`);
        embed.setImage(gear.imgurLink);
        msg.channel.send(embed);
    });
}
async function debug(msg){
    return infometa(msg, (member, gear) => {
        msg.channel.send(`\`\`\`${JSON.stringify(gear, null, 4)}\`\`\``);
    });
}
async function update(msg){
    let name = msg.content.split(" ")[1];
    let member = getUserByName(msg, name);

    if(!member) return
    sendRich(msg.channel, `asking <@!${member.id}> for an updated gear screenshot.`);
    member.send(`A gear update has been requested by an officer. Please DM a gear screenshot in this chat.`);
}
async function deletegear(msg){
    let name = msg.content.split(" ")[1];
    let member = getUserByName(msg, name);

    if(!member) return;
    globals.geardb[member.id] = undefined;
    sendRich(msg.channel, `Deleted <@!${member.id}>'s gear screenshot.`);
    await util.saveGear();
}

async function status(msg){
    let arg = msg.content.split(" ")[1];
    let guildies = globals.guild.members.filter(user => user.roles.exists("name", config.guildRole));
    guildies = guildies.array();

    let categories = {
        unsent: [],
        unverified: [],
        denied: [],
        accepted: [],
        //old: []
    }

    let goodcount = 0;
    let total = 0;

    for(let user of guildies){
        total++;
        let gear = globals.geardb[user.id];
        if(!gear){
            categories.unsent.push(user);
            continue;
        }

        if(gear.status === "accepted"){
            categories.accepted.push(gear);
            goodcount++;
        }else if(gear.status === "unverified"){
            categories.unverified.push(gear);
        }else{
            categories.denied.push(gear);
        }

        //14 days
        //const THRESHOLD = 1000 * 60 * 60 * 24 * 14;
        //const THRESHOLD = 1000 * 60;
        //if(gear.status.date + THRESHOLD < Date.now()){
            //categories.old.push(gear);
        //}
    }

    let embed = new Discord.RichEmbed();
    embed.setTitle("Gear stats");
    embed.setDescription(`${goodcount}/${total}, ${goodcount*100/total | 0}% submissions\n`);
    let c;
    c = categories.unsent    ; embed.addField(c.length + " Unsent",     c.length > 15 && "<many>" || `${c.map(u => ("<@!" + u.id     + ">")).join(" ") || "None"}`);
    c = categories.unverified; embed.addField(c.length + " Unverified", c.length > 15 && "<many>" || `${c.map(u => ("<@!" + u.userID + ">")).join(" ") || "None"}`);
    c = categories.denied    ; embed.addField(c.length + " Denied",     c.length > 15 && "<many>" || `${c.map(u => ("<@!" + u.userID + ">")).join(" ") || "None"}`);
    c = categories.accepted  ; embed.addField(c.length + " Accepted",   c.length > 15 && "<many>" || `${c.map(u => ("<@!" + u.userID + ">")).join(" ") || "None"}`);
    //c = categories.old       ; embed.addField(c.length + " Old (>2wk)", c.length > 15 && "<many>" || `${c.map(u => ("<@!" + u.userID + ">")).join(" ") || "None"}`);
    globals.gearChannelQuery.send({embed});
}

async function help(msg){
    msg.channel.send(`\`\`\`
${config.prefix}gear <name>: Show gear
${config.prefix}gearbackup <name>: Backup link if the first link breaks
${config.prefix}debug: debug info about a user
${config.prefix}update <name>: requests a gear update
${config.prefix}status: gear status
${config.prefix}deletegear <name>: remove gear screenshot
${config.prefix}ping <name>: same as !update\`\`\``);
}

module.exports = {gear, help, debug, gearbackup, update, ping: update, status, deletegear};
