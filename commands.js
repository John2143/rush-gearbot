let globals = require("./variables.js");
const dateFormat = require("dateformat");

function getUserByName(msg, name){
    let member;
    member = msg.mentions.members.first();
    if(!member){
        let users = globals.guild.members.filter(user =>
            user.user.username
                .toLowerCase().includes(name) ||
            (user.nickname || "")
                .toLowerCase().includes(name)
        ).array();
        if(users.length > 1){
            msg.channel.send(`Multiple users with this name, ${users.map(user => user.nickname || user.user.username).join(", ")}`);
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

async function infometa(msg, f){
    let name = msg.content.split(" ")[1];
    let member = getUserByName(msg, name);

    if(!member) return;

    let gear = globals.geardb[member.id];
    if(!gear){
        msg.channel.send(`Could not find gear for <@!${member.id}>`);
    }else{
        f(member, gear);
    }
}

async function gear(msg){
    return infometa(msg, (member, gear) => {
        msg.channel.send(`Gear for <@!${member.id}> ${gear.originalLink}`);
    });
}
async function gearbackup(msg){
    return infometa(msg, (member, gear) => {
        msg.channel.send(`Gear for <@!${member.id}> as of ${dateFormat(globals.dateFormat)} ${gear.imgurLink}`);
    });
}
async function debug(msg){
    return infometa(msg, (member, gear) => {
        msg.channel.send(`\`\`\`${JSON.stringify(gear, null, 4)}\`\`\``);
    });
}
async function bdelete(msg){
    globals.gearChannel.bulkDelete(100);
}
async function update(msg){
    let name = msg.content.split(" ")[1];
    let member = getUserByName(msg, name);

    if(!member) return;
    msg.channel.send(`asking <@!${member.id}> for an updated gear screenshot.`);
    member.send(`A gear update has been requested by an officer. Please DM a gear screenshot in this chat.`);
}


async function help(msg){
    msg.channel.send(`\`\`\`
!gear <name>: Show gear
!gearbackup <name>: Backup link if the first link breaks
!debug: debug info about a user
!update <name>: requests a gear update
!ping <name>: same as !update\`\`\``);
}

module.exports = {gear, help, debug, gearbackup, bdelete, update, ping: update};
