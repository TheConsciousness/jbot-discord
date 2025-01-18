import { Client, Events, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  NoSubscriberBehavior, 
  VoiceConnectionStatus, 
  StreamType 
} from '@discordjs/voice';

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
  .addStringOption(option => option.setName('url').setDescription('YouTube URL').setRequired(true))
  .addStringOption(option => option.setName('stay').setDescription('Whether to stay in the channel after playing stops').setRequired(false));

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user?.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
 console.log(`${message.author.tag}: "${message.content}" ${message.channel}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'stream') {
    const member = interaction.member as GuildMember;
    const channel = member.voice.channel;

    let url = options.get('url')?.value as string;
    let stay = options.get('stay')?.value as string;

    if (!url) {
      url = "./assets/audio/echo.ogg";
    }

    if (!channel) {
      return interaction.reply('You must join a voice channel first!');
    }
    const botMember = interaction.guild!.members.me;

    if (!botMember) {
      return interaction.reply('Bot is not a member of the guild!');
    }

    // Check if the bot has permissions to connect and speak in the channel
    const permissions = channel.permissionsFor(botMember!);

    if (!permissions || !permissions.has(PermissionFlagsBits.Connect)) {
      return interaction.reply('I do not have permission to connect to the voice channel!');
    }

    if (!permissions.has(PermissionFlagsBits.Speak)) {
      return interaction.reply('I do not have permission to speak in the voice channel!');
    }

    try {
      // Defer the interaction to give more time for the bot to process
      await interaction.deferReply();

      // Join the voice channel
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guild!.id,
        adapterCreator: interaction.guild!.voiceAdapterCreator,
      });


      // Send a follow-up message indicating that the bot is playing the audio
      await interaction.followUp('Joining your channel and playing the audio...');

      connection.on(VoiceConnectionStatus.Ready, () => {
        console.log('The bot has connected to the channel!');
      });

      // Create an audio resource from the stream
      const resource = createAudioResource(url);

      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });

      player.play(resource);
      connection.subscribe(player);


      player.on(AudioPlayerStatus.Playing, () => {
        console.log('Now playing: echo.ogg');
      });
 
      if (stay === "false") {
        player.on(AudioPlayerStatus.Idle, () => {
          connection.destroy();
          interaction.followUp('Finished playing the audio!');
        });
      }

    } catch (error) {
      console.error(error);
      interaction.followUp('There was an error trying to play the audio!');
    }
  }
});

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

await client.login(process.env.DISCORD_BOT_TOKEN);
