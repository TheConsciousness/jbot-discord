import { Client, Events, GatewayIntentBits, SlashCommandBuilder, CommandInteraction, GuildMember } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const prefix = "/stream";

// Slash command for '/stream'
const streamCommand = new SlashCommandBuilder()
  .setName('stream')
  .setDescription('Plays a YouTube video in the voice channel.')
  .addStringOption(option => option.setName('url').setDescription('YouTube URL').setRequired(true));

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user?.tag}`);
});

// Handling the slash command
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'stream') {
    const url = options.get('url')?.value as string;
    if (!url || !ytdl.validateURL(url)) {
      return interaction.reply('You need to provide a valid YouTube URL!');
    }

    const member = interaction.member as GuildMember;
    const channel = member.voice.channel;
    if (!channel) {
      return interaction.reply('You must join a voice channel first!');
    }

    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guild!.id,
        adapterCreator: interaction.guild!.voiceAdapterCreator,
      });

      connection.on(VoiceConnectionStatus.Ready, () => {
        console.log('The bot has connected to the channel!');
      });

      // Create a readable stream from ytdl-core (audio-only stream)
      const audioStream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });

      // Create a pass-through stream to process audio through ffmpeg
      const passThroughStream = new PassThrough();
      
      ffmpeg(audioStream)
        .audioCodec('libopus')
        .audioBitrate(128)
        .format('ogg')
        .pipe(passThroughStream, { end: true });

      // Create an audio resource from the pass-through stream
      const resource = createAudioResource(passThroughStream);

      const player = createAudioPlayer();
      player.play(resource);
      connection.subscribe(player);

      player.on(AudioPlayerStatus.Playing, () => {
        interaction.reply(`Now streaming: ${url}`);
      });

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
        interaction.followUp('Finished streaming!');
      });
    } catch (error) {
      console.error(error);
      interaction.reply('There was an error trying to stream the video!');
    }
  }
});

// Registering commands with Discord
const registerCommands = async () => {
  const { REST, Routes } = await import('discord.js');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

  const commands = [
    streamCommand.toJSON(),
  ];

  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.DISCORD_GUILD_ID!),
      { body: commands },
    );
    console.log('Successfully registered slash commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
};

registerCommands().catch(console.error);

// Logging in to Discord
await client.login(process.env.DISCORD_BOT_TOKEN);
