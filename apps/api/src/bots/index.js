"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.botManager = exports.botExecutor = void 0;
exports.initializeBots = initializeBots;
const BotsPackage = __importStar(require("@colloquium/bots"));
const database_1 = require("@colloquium/database");
const bots_1 = require("@colloquium/bots");
// Export the bot executor for use in other parts of the application
exports.botExecutor = new BotsPackage.BotExecutor();
// Export the bot manager for plugin system
exports.botManager = new bots_1.DatabaseBotManager(undefined, exports.botExecutor);
// Create or get bot user in database
async function ensureBotUser(botId, botName) {
    const email = `${botId}@colloquium.bot`;
    let botUser = await database_1.prisma.users.findUnique({
        where: { email }
    });
    if (!botUser) {
        botUser = await database_1.prisma.users.create({
            data: {
                id: `bot-${botId}`,
                email,
                name: botName,
                role: 'BOT',
                updatedAt: new Date()
            }
        });
        // console.log(`✅ Created bot user: ${botName} (${email})`);
    }
    return botUser.id;
}
// Initialize and register all bots
async function initializeBots() {
    console.log('🤖 Initializing bots...');
    // Ensure required system bots are installed in the database
    const installedBots = await exports.botManager.list();
    const requiredBots = ['editorial-bot', 'reference-bot', 'reviewer-checklist'];
    // Check if any required bots are missing
    const missingRequiredBots = requiredBots.filter(requiredBotId => !installedBots.some(bot => bot.manifest.colloquium.botId === requiredBotId));
    if (missingRequiredBots.length > 0) {
        console.log(`🔧 Installing missing required bots: ${missingRequiredBots.join(', ')}`);
        try {
            const installations = await exports.botManager.installDefaults();
            if (installations.length > 0) {
                console.log(`✅ Successfully installed ${installations.length} new bot(s)`);
            }
            else {
                console.log('ℹ️ All required bots are already installed');
            }
        }
        catch (error) {
            // Only log as error if it's not an "already installed" error
            if (error instanceof Error && error.message.includes('already installed')) {
                console.log('ℹ️ Required bots are already installed');
            }
            else {
                console.error('❌ Failed to install required bots:', error);
            }
        }
    }
    // Install additional default bots if this is a fresh installation
    if (installedBots.length === 0) {
        console.log('🔧 Installing default bots for fresh installation...');
        try {
            const installations = await exports.botManager.installDefaults();
            if (installations.length > 0) {
                console.log(`✅ Successfully installed ${installations.length} default bot(s)`);
            }
            else {
                console.log('ℹ️ All default bots are already available');
            }
        }
        catch (error) {
            // Only log as error if it's not an "already installed" error
            if (error instanceof Error && error.message.includes('already installed')) {
                console.log('ℹ️ Default bots are already installed');
            }
            else {
                console.error('❌ Failed to install default bots:', error);
            }
        }
    }
    // Load all installed bots into the BotExecutor
    console.log('🔄 Loading installed bots into executor...');
    try {
        await exports.botManager.reloadAllBots();
        const loadedBots = exports.botExecutor.getCommandBots();
        console.log(`✅ Loaded ${loadedBots.length} bot(s) into executor`);
    }
    catch (error) {
        console.error('❌ Failed to load installed bots:', error);
    }
    // console.log('Bot system initialized');
}
