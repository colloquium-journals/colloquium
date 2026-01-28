'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  TextInput,
  Textarea,
  Switch,
  Alert,
  Loader,
  Divider,
  FileInput,
  Select,
  NumberInput,
  ColorInput,
  Tabs,
  Badge,
  Modal,
  Table,
  ActionIcon,
  Menu,
  List,
  ThemeIcon,
  Box,
  Progress,
  PasswordInput
} from '@mantine/core';
import {
  IconSettings,
  IconAlertCircle,
  IconCheck,
  IconDeviceFloppy,
  IconPhoto,
  IconPalette,
  IconUsers,
  IconMail,
  IconWorld,
  IconShield,
  IconRobot,
  IconPlus,
  IconRefresh,
  IconPower,
  IconDots,
  IconTrash,
  IconDownload,
  IconCode,
  IconFile,
  IconUpload,
  IconFileText,
  IconX,
  IconEdit,
  IconGitBranch,
  IconBell,
  IconClock
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';
import { YamlInput } from '@/components/YamlInput';
import { BotCommandInput } from '@/components/shared/BotCommandInput';
import { MentionSuggestion } from '@/components/shared/MentionSuggest';
import { parseMarkdown } from '@/lib/markdown';
import { WorkflowConfigPanel } from '@/components/admin/WorkflowConfigPanel';
import yaml from 'js-yaml';

interface BotInstallation {
  id: string;
  botId: string;
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email?: string;
  };
  category?: string;
  config?: any;
  isEnabled: boolean;
  isDefault: boolean;
  isRequired?: boolean;
  installedAt: string;
  updatedAt: string;
  packageName: string;
  supportsFileUploads?: boolean;
}

interface BotConfigFile {
  id: string;
  filename: string;
  description?: string;
  mimetype: string;
  size: number;
  checksum: string;
  uploadedAt: string;
  updatedAt: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
  downloadUrl: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'EDITOR_IN_CHIEF' | 'USER';
  orcidId?: string;
  affiliation?: string;
  createdAt: string;
  _count?: {
    manuscript_authors: number;
    reviewAssignments: number;
    authoredMessages: number;
  };
}

interface JournalSettings {
  // Basic Information
  name: string;
  description: string;
  logoUrl?: string;
  faviconUrl?: string;
  
  // Contact Information
  contactEmail: string;
  editorEmail: string;
  publisherName: string;
  publisherLocation: string;
  
  // Appearance
  primaryColor: string;
  secondaryColor: string;
  customCss?: string;
  
  // Submission Settings
  submissionsOpen: boolean;
  maxFileSize: number; // in MB
  maxSupplementalFiles: number;
  allowedFileTypes: string[];
  requireOrcid: boolean;
  autoSubmissionCommands: string[];

  // Review Settings
  defaultReviewPeriod: number; // in days
  allowPublicReviews: boolean;
  requireReviewerRegistration: boolean;

  // Workflow Settings
  workflowTemplateId?: string;
  workflowConfig?: {
    author: {
      seesReviews: 'realtime' | 'on_release' | 'never';
      seesReviewerIdentity: 'always' | 'never' | 'on_release';
      canParticipate: 'anytime' | 'on_release' | 'invited';
    };
    reviewers: {
      seeEachOther: 'realtime' | 'after_all_submit' | 'never';
      seeAuthorIdentity: 'always' | 'never';
      seeAuthorResponses: 'realtime' | 'on_release';
    };
    phases: {
      enabled: boolean;
      authorResponseStartsNewCycle: boolean;
      requireAllReviewsBeforeRelease: boolean;
    };
  };

  // Publication Settings
  issn?: string;
  doi?: string;
  licenseType: string;
  copyrightHolder: string;

  // Crossref Integration
  crossrefEnabled?: boolean;
  crossrefUsername?: string;
  crossrefPassword?: string;
  crossrefTestMode?: boolean;
  doiPrefix?: string;
  eissn?: string;
  abbrevTitle?: string;
  licenseUrl?: string;

  // DOAJ Integration
  doajEnabled?: boolean;
  doajApiKey?: string;
  doajAutoSubmit?: boolean;

  // Email Settings
  enableEmailNotifications: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  
  // Advanced Settings
  enableAnalytics: boolean;
  analyticsId?: string;
  customFooter?: string;
  maintenanceMode: boolean;
  
  // Theme Settings
  enableDarkMode: boolean;
  defaultTheme: 'light' | 'dark' | 'auto';

  // Reminder Settings
  reminderSettings?: {
    enabled?: boolean;
    reviewReminders?: {
      enabled?: boolean;
      intervals?: Array<{
        daysBefore: number;
        enabled: boolean;
        emailEnabled: boolean;
        conversationEnabled: boolean;
      }>;
      overdueReminders?: {
        enabled?: boolean;
        intervalDays?: number;
        maxReminders?: number;
      };
    };
  };
}

export default function JournalSettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const { refreshSettings } = useJournalSettings();
  const [settings, setSettings] = useState<JournalSettings>({
    name: '',
    description: '',
    contactEmail: '',
    editorEmail: '',
    publisherName: '',
    publisherLocation: '',
    primaryColor: '#1976d2',
    secondaryColor: '#424242',
    submissionsOpen: true,
    maxFileSize: 50,
    maxSupplementalFiles: 10,
    allowedFileTypes: ['pdf', 'docx', 'tex', 'zip'],
    requireOrcid: false,
    autoSubmissionCommands: [],
    defaultReviewPeriod: 30,
    allowPublicReviews: true,
    requireReviewerRegistration: true,
    licenseType: 'CC BY 4.0',
    copyrightHolder: '',
    enableEmailNotifications: true,
    enableAnalytics: false,
    maintenanceMode: false,
    enableDarkMode: false,
    defaultTheme: 'light'
  });
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(
    user?.role === 'EDITOR_IN_CHIEF' ? 'users' : 'basic'
  );

  // Bot management state
  const [bots, setBots] = useState<BotInstallation[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsError, setBotsError] = useState<string | null>(null);

  // Bot executor status state
  const [botExecutorStatus, setBotExecutorStatus] = useState<{
    healthy: boolean;
    registeredCount: number;
    installedCount: number;
    bots: Array<{
      botId: string;
      name: string;
      isEnabled: boolean;
      isRegistered: boolean;
      status: 'ready' | 'not_loaded' | 'disabled';
    }>;
  } | null>(null);
  const [executorStatusLoading, setExecutorStatusLoading] = useState(false);
  const [reloadingBots, setReloadingBots] = useState(false);
  
  // Modal states
  const [installModalOpened, { open: openInstallModal, close: closeInstallModal }] = useDisclosure(false);
  const [configModalOpened, { open: openConfigModal, close: closeConfigModal }] = useDisclosure(false);
  const [helpModalOpened, { open: openHelpModal, close: closeHelpModal }] = useDisclosure(false);
  const [selectedBot, setSelectedBot] = useState<BotInstallation | null>(null);
  const [botHelpContent, setBotHelpContent] = useState<string>('');
  
  // Form states
  const [installForm, setInstallForm] = useState({
    type: 'npm' as 'npm' | 'git' | 'local' | 'url',
    packageName: '',
    version: '',
    url: '',
    path: '',
    ref: ''
  });
  const [configForm, setConfigForm] = useState('');
  
  // File configuration states
  const [botFiles, setBotFiles] = useState<BotConfigFile[]>([]);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [botConfigTab, setBotConfigTab] = useState<string | null>('config');
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState('');

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:4000/api/settings/admin', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(prev => ({ ...prev, ...data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Helper function to check if a bot is required
  const isRequiredBot = (botId: string) => {
    return botId === 'bot-editorial';
  };

  // Fetch installed bots
  const fetchBots = async () => {
    try {
      setBotsLoading(true);
      const response = await fetch('http://localhost:4000/api/bot-management', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bots');
      }

      const data = await response.json();
      const botsWithRequiredFlag = (data.data || []).map((bot: BotInstallation) => ({
        ...bot,
        isRequired: isRequiredBot(bot.botId)
      }));
      setBots(botsWithRequiredFlag);
    } catch (err) {
      setBotsError(err instanceof Error ? err.message : 'Failed to load bots');
    } finally {
      setBotsLoading(false);
    }
  };

  // Fetch bot executor status
  const fetchExecutorStatus = async () => {
    try {
      setExecutorStatusLoading(true);
      const response = await fetch('http://localhost:4000/api/bot-management/status/executor', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch executor status');
      }

      const data = await response.json();
      setBotExecutorStatus(data.data);
    } catch (err) {
      console.error('Failed to fetch executor status:', err);
      setBotExecutorStatus(null);
    } finally {
      setExecutorStatusLoading(false);
    }
  };

  // Reload bots into executor
  const handleReloadBots = async () => {
    try {
      setReloadingBots(true);
      const response = await fetch('http://localhost:4000/api/bot-management/reload', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to reload bots');
      }

      const data = await response.json();
      notifications.show({
        title: 'Bots Reloaded',
        message: `Successfully loaded ${data.data.loadedCount} bot(s)`,
        color: 'green'
      });

      // Refresh status and bot list
      await fetchExecutorStatus();
      await fetchBots();
    } catch (err) {
      notifications.show({
        title: 'Reload Failed',
        message: err instanceof Error ? err.message : 'Failed to reload bots',
        color: 'red'
      });
    } finally {
      setReloadingBots(false);
    }
  };

  // Fetch bots when switching to bots or submissions tab
  useEffect(() => {
    if (activeTab === 'bots') {
      fetchBots();
      fetchExecutorStatus();
    } else if (activeTab === 'submissions') {
      fetchBots();
    }
  }, [activeTab]);

  const botSuggestions: MentionSuggestion[] = bots
    .filter(bot => bot.isEnabled)
    .map(bot => ({
      id: bot.botId,
      name: bot.botId,
      displayName: bot.name,
      type: 'bot' as const,
      description: bot.description,
    }));

  // Fetch users with role filtering
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      
      const params = new URLSearchParams();
      if (roleFilter !== 'all') {
        params.set('role', roleFilter);
      }
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      
      const response = await fetch(`http://localhost:4000/api/users?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      // Filter out any bot-like users (emails ending with @colloquium.ai or containing "bot")
      const filteredUsers = (data.users || []).filter((user: User) => 
        !user.email.endsWith('@colloquium.ai') && 
        !user.email.toLowerCase().includes('bot') &&
        !user.name?.toLowerCase().includes('bot')
      );
      setUsers(filteredUsers);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch users when switching to users tab or when filters change
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, roleFilter, searchTerm]);

  // Upload logo
  const handleLogoUpload = async () => {
    if (!logoFile) return;

    try {
      setIsUploadingLogo(true);
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await fetch('http://localhost:4000/api/settings/logo', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }

      const data = await response.json();
      setSettings(prev => ({ ...prev, logoUrl: data.logoUrl }));
      setLogoFile(null);

      notifications.show({
        title: 'Success',
        message: 'Logo uploaded successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      // Refresh the global settings context
      await refreshSettings();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to upload logo',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch('http://localhost:4000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      notifications.show({
        title: 'Success',
        message: 'Journal settings saved successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      setSaving(false);
      
      // Refresh the global settings context after a brief delay to prevent loading cascade
      setTimeout(() => {
        refreshSettings();
      }, 100);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save settings',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      setSaving(false);
    }
  };

  // Install bot
  const handleInstallBot = async () => {
    try {
      const source: any = { type: installForm.type };
      
      if (installForm.type === 'npm') {
        source.packageName = installForm.packageName;
        if (installForm.version) source.version = installForm.version;
      } else if (installForm.type === 'git' || installForm.type === 'url') {
        source.url = installForm.url;
        if (installForm.ref) source.ref = installForm.ref;
      } else if (installForm.type === 'local') {
        source.path = installForm.path;
      }

      const response = await fetch('http://localhost:4000/api/bot-management/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ source })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to install bot');
      }

      notifications.show({
        title: 'Success',
        message: 'Bot installed successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      closeInstallModal();
      setInstallForm({
        type: 'npm',
        packageName: '',
        version: '',
        url: '',
        path: '',
        ref: ''
      });
      await fetchBots();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to install bot',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Toggle bot enable/disable
  const handleToggleBot = async (botId: string, enable: boolean) => {
    if (isRequiredBot(botId) && !enable) {
      notifications.show({
        title: 'Cannot Disable',
        message: 'This bot is required for the platform and cannot be disabled.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    try {
      const endpoint = enable ? 'enable' : 'disable';
      const response = await fetch(`http://localhost:4000/api/bot-management/${botId}/${endpoint}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to ${enable ? 'enable' : 'disable'} bot`);
      }

      notifications.show({
        title: 'Success',
        message: `Bot ${enable ? 'enabled' : 'disabled'} successfully`,
        color: 'green',
        icon: <IconCheck size={16} />
      });

      await fetchBots();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update bot',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Uninstall bot
  const handleUninstallBot = async (botId: string) => {
    if (isRequiredBot(botId)) {
      notifications.show({
        title: 'Cannot Uninstall',
        message: 'This bot is required for the platform and cannot be uninstalled.',
        color: 'orange',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }
    
    if (!confirm('Are you sure you want to uninstall this bot?')) return;

    try {
      const response = await fetch(`http://localhost:4000/api/bot-management/${botId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to uninstall bot');
      }

      notifications.show({
        title: 'Success',
        message: 'Bot uninstalled successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      await fetchBots();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to uninstall bot',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Fetch bot files
  const fetchBotFiles = async (botId: string) => {
    try {
      const response = await fetch(`http://localhost:4000/api/bot-config-files/${botId}/files`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bot files');
      }

      const data = await response.json();
      setBotFiles(data.files || []);
    } catch (err) {
      console.error('Error fetching bot files:', err);
      setBotFiles([]);
    }
  };

  // Upload file
  const handleFileUpload = async () => {
    if (!selectedBot || !fileToUpload) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (fileDescription) {
        formData.append('description', fileDescription);
      }

      // Simulate progress (in real implementation, you'd use XMLHttpRequest for actual progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const response = await fetch(`http://localhost:4000/api/bot-config-files/${selectedBot.botId}/files`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      notifications.show({
        title: 'Success',
        message: 'File uploaded successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      // Reset form
      setFileToUpload(null);
      setFileDescription('');
      
      // Refresh files list
      await fetchBotFiles(selectedBot.botId);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to upload file',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Rename file
  const handleRenameFile = async (fileId: string, newFilename: string) => {
    if (!selectedBot || !newFilename.trim()) return;

    try {
      const response = await fetch(`http://localhost:4000/api/bot-config-files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename: newFilename.trim() })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename file');
      }

      notifications.show({
        title: 'Success',
        message: 'File renamed successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      // Reset editing state
      setEditingFileId(null);
      setEditingFileName('');
      
      // Refresh files list
      await fetchBotFiles(selectedBot.botId);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to rename file',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`http://localhost:4000/api/bot-config-files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      notifications.show({
        title: 'Success',
        message: 'File deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      // Refresh files list
      if (selectedBot) {
        await fetchBotFiles(selectedBot.botId);
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete file',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Fetch bot configuration
  const fetchBotConfig = async (botId: string) => {
    try {
      const response = await fetch(`http://localhost:4000/api/bot-management/${botId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bot configuration');
      }

      const data = await response.json();
      
      // Use yamlConfig if available (with comments), otherwise fall back to parsed config
      if (data.data.yamlConfig) {
        setConfigForm(data.data.yamlConfig);
      } else {
        const config = data.data.config || {};
        // Convert to YAML format for display
        setConfigForm(yaml.dump(config, { indent: 2 }));
      }
    } catch (err) {
      console.error('Error fetching bot config:', err);
      setConfigForm('');
      notifications.show({
        title: 'Warning',
        message: 'Could not load current configuration, showing empty config',
        color: 'orange',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Configure bot
  const handleConfigureBot = async () => {
    if (!selectedBot) return;

    try {
      // Send the raw config string to preserve comments
      const response = await fetch(`http://localhost:4000/api/bot-management/${selectedBot.botId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: configForm })
      });

      if (!response.ok) {
        throw new Error('Failed to update bot configuration');
      }

      notifications.show({
        title: 'Success',
        message: 'Bot configuration updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      closeConfigModal();
      await fetchBots();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update configuration',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Fetch bot help
  const handleViewBotHelp = async (bot: BotInstallation) => {
    try {
      setSelectedBot(bot);
      setBotHelpContent('Loading help content...');
      openHelpModal();

      const response = await fetch(`http://localhost:4000/api/bot-management/${bot.botId}/help`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bot help');
      }

      const data = await response.json();
      setBotHelpContent(data.data.helpContent);
    } catch (err) {
      setBotHelpContent('Failed to load help content. Please try again.');
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to load bot help',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Install default bots
  const handleInstallDefaults = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/bot-management/install-defaults', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to install default bots');
      }

      notifications.show({
        title: 'Success',
        message: 'Default bots installed successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      await fetchBots();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to install default bots',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  // Change user role
  const handleChangeUserRole = async (userId: string, newRole: 'ADMIN' | 'EDITOR_IN_CHIEF' | 'USER') => {
    try {
      // Map frontend roles to backend roles
      const roleMapping = {
        'ADMIN': 'ADMIN',
        'EDITOR_IN_CHIEF': 'EDITOR_IN_CHIEF',
        'USER': 'USER'
      };
      
      const response = await fetch(`http://localhost:4000/api/users/${userId}/role`, {
        method: 'POST', // The API uses POST, not PUT
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: roleMapping[newRole] })
      });

      if (!response.ok) {
        throw new Error('Failed to update user role');
      }

      notifications.show({
        title: 'Success',
        message: 'User role updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });

      await fetchUsers();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update user role',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };


  // Check if user is admin
  if (!isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'EDITOR_IN_CHIEF')) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Admin or Editor-in-Chief access required to manage journal settings.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading settings...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Title order={1}>Journal Settings</Title>
            <Text c="dimmed">
              Configure your journal's appearance, policies, and functionality
            </Text>
          </Stack>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSaveSettings}
            loading={saving}
          >
            Save Settings
          </Button>
        </Group>

        {/* Error display */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {error}
          </Alert>
        )}

        {/* Settings Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="basic" leftSection={<IconSettings size={16} />}>
                Basic Info
              </Tabs.Tab>
            )}
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="appearance" leftSection={<IconPalette size={16} />}>
                Appearance
              </Tabs.Tab>
            )}
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="submissions" leftSection={<IconUsers size={16} />}>
                Submissions
              </Tabs.Tab>
            )}
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="publishing" leftSection={<IconWorld size={16} />}>
                Publishing
              </Tabs.Tab>
            )}
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="email" leftSection={<IconMail size={16} />}>
                Email
              </Tabs.Tab>
            )}
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="workflow" leftSection={<IconGitBranch size={16} />}>
                Review Workflow
              </Tabs.Tab>
            )}
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="reminders" leftSection={<IconBell size={16} />}>
                Reminders
              </Tabs.Tab>
            )}
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="advanced" leftSection={<IconShield size={16} />}>
                Advanced
              </Tabs.Tab>
            )}
            {user?.role === 'ADMIN' && (
              <Tabs.Tab value="bots" leftSection={<IconRobot size={16} />}>
                Bots
              </Tabs.Tab>
            )}
            <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
              Users
            </Tabs.Tab>
          </Tabs.List>

          {/* Basic Information Tab */}
          <Tabs.Panel value="basic">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="md">
                <Title order={3}>Basic Information</Title>
                
                <TextInput
                  label="Journal Name"
                  placeholder="Enter journal name"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  required
                />

                <Textarea
                  label="Description"
                  placeholder="Brief description of your journal"
                  value={settings.description}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                  minRows={3}
                />

                <Group grow>
                  <TextInput
                    label="Contact Email"
                    placeholder="contact@journal.com"
                    value={settings.contactEmail}
                    onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                    type="email"
                  />
                  <TextInput
                    label="Editor Email"
                    placeholder="editor@journal.com"
                    value={settings.editorEmail}
                    onChange={(e) => setSettings({ ...settings, editorEmail: e.target.value })}
                    type="email"
                  />
                </Group>

                <Group grow>
                  <TextInput
                    label="Publisher Name"
                    placeholder="University Press"
                    value={settings.publisherName}
                    onChange={(e) => setSettings({ ...settings, publisherName: e.target.value })}
                  />
                  <TextInput
                    label="Publisher Location"
                    placeholder="City, Country"
                    value={settings.publisherLocation}
                    onChange={(e) => setSettings({ ...settings, publisherLocation: e.target.value })}
                  />
                </Group>

                <Stack gap="xs">
                  <Text size="sm" fw={500}>Logo</Text>
                  {settings.logoUrl && (
                    <Group gap="md">
                      <img 
                        src={settings.logoUrl.startsWith('http') ? settings.logoUrl : `http://localhost:4000${settings.logoUrl}`} 
                        alt="Current logo" 
                        style={{ height: 48, objectFit: 'contain' }}
                      />
                      <Text size="sm" c="dimmed">Current logo</Text>
                    </Group>
                  )}
                  <FileInput
                    placeholder="Upload new journal logo"
                    accept="image/*"
                    value={logoFile}
                    onChange={setLogoFile}
                    leftSection={<IconPhoto size={16} />}
                  />
                  {logoFile && (
                    <Button
                      size="xs"
                      onClick={handleLogoUpload}
                      loading={isUploadingLogo}
                      leftSection={<IconUpload size={14} />}
                    >
                      Upload Logo
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Card>
          </Tabs.Panel>

          {/* Appearance Tab */}
          <Tabs.Panel value="appearance">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="md">
                <Title order={3}>Appearance</Title>
                
                <Group grow>
                  <ColorInput
                    label="Primary Color"
                    value={settings.primaryColor}
                    onChange={(value) => setSettings({ ...settings, primaryColor: value })}
                  />
                  <ColorInput
                    label="Secondary Color"
                    value={settings.secondaryColor}
                    onChange={(value) => setSettings({ ...settings, secondaryColor: value })}
                  />
                </Group>

                <Textarea
                  label="Custom CSS"
                  placeholder="/* Custom styles for your journal */"
                  value={settings.customCss || ''}
                  onChange={(e) => setSettings({ ...settings, customCss: e.target.value })}
                  minRows={5}
                />

                <Textarea
                  label="Custom Footer"
                  placeholder="Additional footer content"
                  value={settings.customFooter || ''}
                  onChange={(e) => setSettings({ ...settings, customFooter: e.target.value })}
                  minRows={3}
                />

                <Divider label="Theme" />

                <Switch
                  label="Enable Dark Mode"
                  description="Allow users to switch between light and dark themes"
                  checked={settings.enableDarkMode}
                  onChange={(e) => setSettings({ ...settings, enableDarkMode: e.currentTarget.checked })}
                />

                {settings.enableDarkMode && (
                  <Select
                    label="Default Theme"
                    description="Default theme for new visitors"
                    value={settings.defaultTheme}
                    onChange={(value) => setSettings({ ...settings, defaultTheme: (value as 'light' | 'dark' | 'auto') || 'light' })}
                    data={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                      { value: 'auto', label: 'Follow System' }
                    ]}
                  />
                )}
              </Stack>
            </Card>
          </Tabs.Panel>

          {/* Submissions Tab */}
          <Tabs.Panel value="submissions">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="md">
                <Title order={3}>Submission Settings</Title>
                
                <Switch
                  label="Accept Submissions"
                  description="Allow new manuscript submissions"
                  checked={settings.submissionsOpen}
                  onChange={(e) => setSettings({ ...settings, submissionsOpen: e.currentTarget.checked })}
                />

                <NumberInput
                  label="Maximum File Size (MB)"
                  value={settings.maxFileSize}
                  onChange={(value) => setSettings({ ...settings, maxFileSize: Number(value) || 50 })}
                  min={1}
                  max={500}
                />

                <NumberInput
                  label="Maximum Supplemental Files"
                  description="Maximum number of supplemental/asset files per submission (0 = unlimited)"
                  value={settings.maxSupplementalFiles}
                  onChange={(value) => setSettings({ ...settings, maxSupplementalFiles: Number(value) ?? 10 })}
                  min={0}
                  max={100}
                />

                <Switch
                  label="Require ORCID"
                  description="Require authors to provide ORCID iD"
                  checked={settings.requireOrcid}
                  onChange={(e) => setSettings({ ...settings, requireOrcid: e.currentTarget.checked })}
                />

                <Divider label="Auto-Invoke Commands" />
                <Text size="sm" c="dimmed">
                  Bot commands to automatically run on every new submission.
                  Use the format @bot-name command (e.g., @bot-markdown-renderer render).
                </Text>
                {(settings.autoSubmissionCommands || []).map((cmd, index) => (
                  <Group key={index}>
                    <BotCommandInput
                      value={cmd}
                      onChange={(newValue) => {
                        const updated = [...(settings.autoSubmissionCommands || [])];
                        updated[index] = newValue;
                        setSettings({ ...settings, autoSubmissionCommands: updated });
                      }}
                      bots={botSuggestions}
                    />
                    <ActionIcon color="red" variant="light" onClick={() => {
                      const updated = (settings.autoSubmissionCommands || []).filter((_, i) => i !== index);
                      setSettings({ ...settings, autoSubmissionCommands: updated });
                    }}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                ))}
                <Button
                  variant="light"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    setSettings({
                      ...settings,
                      autoSubmissionCommands: [...(settings.autoSubmissionCommands || []), '']
                    });
                  }}
                >
                  Add Command
                </Button>

                <Divider label="Review Settings" />

                <NumberInput
                  label="Default Review Period (days)"
                  value={settings.defaultReviewPeriod}
                  onChange={(value) => setSettings({ ...settings, defaultReviewPeriod: Number(value) || 30 })}
                  min={7}
                  max={365}
                />

                <Switch
                  label="Allow Public Reviews"
                  description="Enable public review conversations"
                  checked={settings.allowPublicReviews}
                  onChange={(e) => setSettings({ ...settings, allowPublicReviews: e.currentTarget.checked })}
                />

                <Switch
                  label="Require Reviewer Registration"
                  description="Reviewers must register to participate"
                  checked={settings.requireReviewerRegistration}
                  onChange={(e) => setSettings({ ...settings, requireReviewerRegistration: e.currentTarget.checked })}
                />
              </Stack>
            </Card>
          </Tabs.Panel>

          {/* Review Workflow Tab */}
          <Tabs.Panel value="workflow">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <WorkflowConfigPanel
                currentTemplateId={settings.workflowTemplateId}
                currentConfig={settings.workflowConfig}
                onSave={async (templateId, config) => {
                  const newSettings = {
                    ...settings,
                    workflowTemplateId: templateId || undefined,
                    workflowConfig: config || undefined
                  };
                  setSettings(newSettings);
                  // handleSaveSettings will use the current state, but we need to save these specific settings
                  try {
                    const response = await fetch('http://localhost:4000/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(newSettings)
                    });
                    if (!response.ok) throw new Error('Failed to save');
                  } catch (error) {
                    throw error;
                  }
                }}
              />
            </Card>
          </Tabs.Panel>

          {/* Reminders Tab */}
          <Tabs.Panel value="reminders">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="md">
                <Title order={3}>Deadline Reminders</Title>
                <Text size="sm" c="dimmed">
                  Configure automated reminders for reviewers approaching or past their review deadlines.
                </Text>

                <Switch
                  label="Enable Reminder System"
                  description="Master toggle for all automated deadline reminders"
                  checked={settings.reminderSettings?.enabled ?? true}
                  onChange={(e) => setSettings({
                    ...settings,
                    reminderSettings: {
                      ...settings.reminderSettings,
                      enabled: e.currentTarget.checked
                    }
                  })}
                />

                {settings.reminderSettings?.enabled && (
                  <>
                    <Divider label="Review Reminders" />

                    <Switch
                      label="Enable Review Deadline Reminders"
                      description="Send reminders to reviewers as their deadlines approach"
                      checked={settings.reminderSettings?.reviewReminders?.enabled ?? true}
                      onChange={(e) => setSettings({
                        ...settings,
                        reminderSettings: {
                          ...settings.reminderSettings,
                          reviewReminders: {
                            ...settings.reminderSettings?.reviewReminders,
                            enabled: e.currentTarget.checked
                          }
                        }
                      })}
                    />

                    {settings.reminderSettings?.reviewReminders?.enabled && (
                      <>
                        <Card withBorder p="md">
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Text fw={500}>Reminder Intervals</Text>
                              <Button
                                size="xs"
                                variant="light"
                                leftSection={<IconPlus size={14} />}
                                onClick={() => {
                                  const currentIntervals = settings.reminderSettings?.reviewReminders?.intervals || [];
                                  const existingDays = new Set(currentIntervals.map((i: { daysBefore: number }) => i.daysBefore));
                                  // Find next available day value using common reminder intervals
                                  const preferredDays = [7, 3, 1, 14, 5, 2, 10, 21, 28];
                                  let newDaysBefore = preferredDays.find(d => !existingDays.has(d)) ?? 0;
                                  // If all preferred days are taken, find first available from 0-60
                                  if (existingDays.has(newDaysBefore)) {
                                    for (let i = 0; i <= 60; i++) {
                                      if (!existingDays.has(i)) {
                                        newDaysBefore = i;
                                        break;
                                      }
                                    }
                                  }
                                  setSettings({
                                    ...settings,
                                    reminderSettings: {
                                      ...settings.reminderSettings,
                                      reviewReminders: {
                                        ...settings.reminderSettings?.reviewReminders,
                                        intervals: [
                                          ...currentIntervals,
                                          { daysBefore: newDaysBefore, enabled: true, emailEnabled: true, conversationEnabled: true }
                                        ]
                                      }
                                    }
                                  });
                                }}
                              >
                                Add Interval
                              </Button>
                            </Group>
                            <Text size="xs" c="dimmed">
                              Configure when to send reminders before the review deadline.
                            </Text>

                            {(settings.reminderSettings?.reviewReminders?.intervals || []).map((interval: any, index: number) => (
                              <Card key={index} withBorder p="sm" bg="gray.0">
                                <Group justify="space-between" wrap="nowrap">
                                  <Group gap="md" wrap="nowrap">
                                    <Switch
                                      size="sm"
                                      checked={interval.enabled}
                                      onChange={(e) => {
                                        const intervals = [...(settings.reminderSettings?.reviewReminders?.intervals || [])];
                                        intervals[index] = { ...intervals[index], enabled: e.currentTarget.checked };
                                        setSettings({
                                          ...settings,
                                          reminderSettings: {
                                            ...settings.reminderSettings,
                                            reviewReminders: {
                                              ...settings.reminderSettings?.reviewReminders,
                                              intervals
                                            }
                                          }
                                        });
                                      }}
                                    />
                                    <NumberInput
                                      size="xs"
                                      w={80}
                                      min={0}
                                      max={60}
                                      value={interval.daysBefore}
                                      onChange={(value) => {
                                        const newValue = typeof value === 'number' ? value : 0;
                                        const intervals = [...(settings.reminderSettings?.reviewReminders?.intervals || [])];
                                        // Check for duplicates (excluding current interval)
                                        const hasDuplicate = intervals.some((i: { daysBefore: number }, idx: number) =>
                                          idx !== index && i.daysBefore === newValue
                                        );
                                        if (hasDuplicate) {
                                          notifications.show({
                                            title: 'Duplicate Interval',
                                            message: `A reminder for ${newValue} days before already exists`,
                                            color: 'orange',
                                          });
                                          return;
                                        }
                                        intervals[index] = { ...intervals[index], daysBefore: newValue };
                                        setSettings({
                                          ...settings,
                                          reminderSettings: {
                                            ...settings.reminderSettings,
                                            reviewReminders: {
                                              ...settings.reminderSettings?.reviewReminders,
                                              intervals
                                            }
                                          }
                                        });
                                      }}
                                      suffix=" days"
                                      disabled={!interval.enabled}
                                    />
                                    <Text size="sm" c={interval.enabled ? undefined : 'dimmed'}>
                                      {interval.daysBefore === 0 ? 'on due date' : 'before deadline'}
                                    </Text>
                                  </Group>
                                  <Group gap="xs" wrap="nowrap">
                                    <Switch
                                      size="xs"
                                      label="Email"
                                      checked={interval.emailEnabled}
                                      disabled={!interval.enabled}
                                      onChange={(e) => {
                                        const intervals = [...(settings.reminderSettings?.reviewReminders?.intervals || [])];
                                        intervals[index] = { ...intervals[index], emailEnabled: e.currentTarget.checked };
                                        setSettings({
                                          ...settings,
                                          reminderSettings: {
                                            ...settings.reminderSettings,
                                            reviewReminders: {
                                              ...settings.reminderSettings?.reviewReminders,
                                              intervals
                                            }
                                          }
                                        });
                                      }}
                                    />
                                    <Switch
                                      size="xs"
                                      label="Chat"
                                      checked={interval.conversationEnabled}
                                      disabled={!interval.enabled}
                                      onChange={(e) => {
                                        const intervals = [...(settings.reminderSettings?.reviewReminders?.intervals || [])];
                                        intervals[index] = { ...intervals[index], conversationEnabled: e.currentTarget.checked };
                                        setSettings({
                                          ...settings,
                                          reminderSettings: {
                                            ...settings.reminderSettings,
                                            reviewReminders: {
                                              ...settings.reminderSettings?.reviewReminders,
                                              intervals
                                            }
                                          }
                                        });
                                      }}
                                    />
                                    <ActionIcon
                                      size="sm"
                                      variant="subtle"
                                      color="red"
                                      onClick={() => {
                                        const intervals = (settings.reminderSettings?.reviewReminders?.intervals || []).filter((_: any, i: number) => i !== index);
                                        setSettings({
                                          ...settings,
                                          reminderSettings: {
                                            ...settings.reminderSettings,
                                            reviewReminders: {
                                              ...settings.reminderSettings?.reviewReminders,
                                              intervals
                                            }
                                          }
                                        });
                                      }}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Group>
                                </Group>
                              </Card>
                            ))}

                            {(settings.reminderSettings?.reviewReminders?.intervals || []).length === 0 && (
                              <Text size="sm" c="dimmed" ta="center" py="md">
                                No reminder intervals configured. Click "Add Interval" to create one.
                              </Text>
                            )}
                          </Stack>
                        </Card>

                        <Card withBorder p="md">
                          <Stack gap="sm">
                            <Switch
                              label="Enable Overdue Reminders"
                              description="Send periodic reminders after the deadline has passed"
                              checked={settings.reminderSettings?.reviewReminders?.overdueReminders?.enabled ?? true}
                              onChange={(e) => setSettings({
                                ...settings,
                                reminderSettings: {
                                  ...settings.reminderSettings,
                                  reviewReminders: {
                                    ...settings.reminderSettings?.reviewReminders,
                                    overdueReminders: {
                                      ...settings.reminderSettings?.reviewReminders?.overdueReminders,
                                      enabled: e.currentTarget.checked
                                    }
                                  }
                                }
                              })}
                            />

                            {settings.reminderSettings?.reviewReminders?.overdueReminders?.enabled && (
                              <Group grow>
                                <NumberInput
                                  label="Reminder Interval"
                                  description="Days between overdue reminders"
                                  min={1}
                                  max={14}
                                  value={settings.reminderSettings?.reviewReminders?.overdueReminders?.intervalDays ?? 3}
                                  onChange={(value) => setSettings({
                                    ...settings,
                                    reminderSettings: {
                                      ...settings.reminderSettings,
                                      reviewReminders: {
                                        ...settings.reminderSettings?.reviewReminders,
                                        overdueReminders: {
                                          ...settings.reminderSettings?.reviewReminders?.overdueReminders,
                                          intervalDays: typeof value === 'number' ? value : 3
                                        }
                                      }
                                    }
                                  })}
                                />
                                <NumberInput
                                  label="Maximum Reminders"
                                  description="Stop after this many overdue reminders"
                                  min={1}
                                  max={10}
                                  value={settings.reminderSettings?.reviewReminders?.overdueReminders?.maxReminders ?? 3}
                                  onChange={(value) => setSettings({
                                    ...settings,
                                    reminderSettings: {
                                      ...settings.reminderSettings,
                                      reviewReminders: {
                                        ...settings.reminderSettings?.reviewReminders,
                                        overdueReminders: {
                                          ...settings.reminderSettings?.reviewReminders?.overdueReminders,
                                          maxReminders: typeof value === 'number' ? value : 3
                                        }
                                      }
                                    }
                                  })}
                                />
                              </Group>
                            )}
                          </Stack>
                        </Card>
                      </>
                    )}
                  </>
                )}

                <Alert icon={<IconClock size={16} />} color="blue" variant="light">
                  <Text size="sm">
                    Reminders are processed daily at 8 AM server time. Editors can also send manual reminders
                    using <code>@bot-editorial send-reminder @reviewer</code> in editorial conversations.
                  </Text>
                </Alert>
              </Stack>
            </Card>
          </Tabs.Panel>

          {/* Publishing Tab */}
          <Tabs.Panel value="publishing">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="md">
                <Title order={3}>Publication Settings</Title>
                
                <Group grow>
                  <TextInput
                    label="ISSN"
                    placeholder="0000-0000"
                    value={settings.issn || ''}
                    onChange={(e) => setSettings({ ...settings, issn: e.target.value })}
                  />
                  <TextInput
                    label="DOI Prefix"
                    placeholder="10.1000"
                    value={settings.doi || ''}
                    onChange={(e) => setSettings({ ...settings, doi: e.target.value })}
                  />
                </Group>

                <Select
                  label="Default License"
                  value={settings.licenseType}
                  onChange={(value) => setSettings({ ...settings, licenseType: value || 'CC BY 4.0' })}
                  data={[
                    'CC BY 4.0',
                    'CC BY-SA 4.0',
                    'CC BY-NC 4.0',
                    'CC BY-NC-SA 4.0',
                    'CC BY-ND 4.0',
                    'CC BY-NC-ND 4.0',
                    'All Rights Reserved'
                  ]}
                />

                <TextInput
                  label="Copyright Holder"
                  placeholder="Copyright holder name"
                  value={settings.copyrightHolder}
                  onChange={(e) => setSettings({ ...settings, copyrightHolder: e.target.value })}
                />

                <Divider label="Crossref Integration" labelPosition="center" my="md" />

                <Switch
                  label="Enable Crossref DOI Registration"
                  description="Automatically register DOIs with Crossref when manuscripts are published"
                  checked={settings.crossrefEnabled || false}
                  onChange={(e) => setSettings({ ...settings, crossrefEnabled: e.currentTarget.checked })}
                />

                {settings.crossrefEnabled && (
                  <Stack gap="sm">
                    <Group grow>
                      <TextInput
                        label="Crossref Username"
                        placeholder="Your Crossref username"
                        value={settings.crossrefUsername || ''}
                        onChange={(e) => setSettings({ ...settings, crossrefUsername: e.target.value })}
                      />
                      <PasswordInput
                        label="Crossref Password"
                        placeholder="Your Crossref password"
                        value={settings.crossrefPassword === '***hidden***' ? '' : (settings.crossrefPassword || '')}
                        onChange={(e) => setSettings({ ...settings, crossrefPassword: e.target.value })}
                      />
                    </Group>

                    <Switch
                      label="Test Mode"
                      description="Use test.crossref.org instead of production (recommended for testing)"
                      checked={settings.crossrefTestMode !== false}
                      onChange={(e) => setSettings({ ...settings, crossrefTestMode: e.currentTarget.checked })}
                    />

                    <TextInput
                      label="DOI Prefix"
                      description="Your registered DOI prefix from Crossref"
                      placeholder="10.12345"
                      value={settings.doiPrefix || ''}
                      onChange={(e) => setSettings({ ...settings, doiPrefix: e.target.value })}
                    />

                    <TextInput
                      label="Electronic ISSN"
                      description="ISSN for the electronic/online version of your journal"
                      placeholder="0000-0000"
                      value={settings.eissn || ''}
                      onChange={(e) => setSettings({ ...settings, eissn: e.target.value })}
                    />

                    <TextInput
                      label="Abbreviated Title"
                      description="Short form of journal name for citations"
                      placeholder="J. Exp. Psychol."
                      value={settings.abbrevTitle || ''}
                      onChange={(e) => setSettings({ ...settings, abbrevTitle: e.target.value })}
                    />

                    <TextInput
                      label="License URL"
                      description="URL to the license for published articles"
                      placeholder="https://creativecommons.org/licenses/by/4.0/"
                      value={settings.licenseUrl || ''}
                      onChange={(e) => setSettings({ ...settings, licenseUrl: e.target.value })}
                    />
                  </Stack>
                )}

                <Divider label="DOAJ Integration" labelPosition="center" my="md" />

                <Switch
                  label="Enable DOAJ Integration"
                  description="Submit published articles to the Directory of Open Access Journals"
                  checked={settings.doajEnabled || false}
                  onChange={(e) => setSettings({ ...settings, doajEnabled: e.currentTarget.checked })}
                />

                {settings.doajEnabled && (
                  <Stack gap="sm">
                    <PasswordInput
                      label="DOAJ API Key"
                      placeholder="Your DOAJ API key"
                      value={settings.doajApiKey === '***hidden***' ? '' : (settings.doajApiKey || '')}
                      onChange={(e) => setSettings({ ...settings, doajApiKey: e.target.value })}
                      description="Get your API key from your DOAJ publisher dashboard"
                    />

                    <Switch
                      label="Auto-Submit on Publish"
                      description="Automatically submit articles to DOAJ when they are published"
                      checked={settings.doajAutoSubmit || false}
                      onChange={(e) => setSettings({ ...settings, doajAutoSubmit: e.currentTarget.checked })}
                    />
                  </Stack>
                )}
              </Stack>
            </Card>
          </Tabs.Panel>

          {/* Email Tab */}
          <Tabs.Panel value="email">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="md">
                <Title order={3}>Email Configuration</Title>
                
                <Switch
                  label="Enable Email Notifications"
                  description="Send email notifications for journal activities"
                  checked={settings.enableEmailNotifications}
                  onChange={(e) => setSettings({ ...settings, enableEmailNotifications: e.currentTarget.checked })}
                />

                {settings.enableEmailNotifications && (
                  <>
                    <Divider label="SMTP Settings" />
                    
                    <Group grow>
                      <TextInput
                        label="SMTP Host"
                        placeholder="smtp.gmail.com"
                        value={settings.smtpHost || ''}
                        onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                      />
                      <NumberInput
                        label="SMTP Port"
                        placeholder="587"
                        value={settings.smtpPort || 587}
                        onChange={(value) => setSettings({ ...settings, smtpPort: Number(value) || 587 })}
                      />
                    </Group>

                    <Group grow>
                      <TextInput
                        label="SMTP Username"
                        placeholder="your-email@domain.com"
                        value={settings.smtpUsername || ''}
                        onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })}
                      />
                      <TextInput
                        label="SMTP Password"
                        placeholder="Your email password"
                        type="password"
                        value={settings.smtpPassword || ''}
                        onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                      />
                    </Group>
                  </>
                )}
              </Stack>
            </Card>
          </Tabs.Panel>

          {/* Advanced Tab */}
          <Tabs.Panel value="advanced">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="md">
                <Title order={3}>Advanced Settings</Title>
                
                <Switch
                  label="Enable Analytics"
                  description="Track website usage with Google Analytics"
                  checked={settings.enableAnalytics}
                  onChange={(e) => setSettings({ ...settings, enableAnalytics: e.currentTarget.checked })}
                />

                {settings.enableAnalytics && (
                  <TextInput
                    label="Analytics ID"
                    placeholder="G-XXXXXXXXXX"
                    value={settings.analyticsId || ''}
                    onChange={(e) => setSettings({ ...settings, analyticsId: e.target.value })}
                  />
                )}

                <Divider />

                <Switch
                  label="Maintenance Mode"
                  description="Temporarily disable public access to the journal"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.currentTarget.checked })}
                />

              </Stack>
            </Card>
          </Tabs.Panel>

          {/* Bots Tab */}
          <Tabs.Panel value="bots">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="xl">
                {/* Header */}
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs">
                    <Title order={3}>Bot Management</Title>
                    <Text c="dimmed">
                      Install and manage bots for your journal
                    </Text>
                  </Stack>
                  <Group>
                    <Button
                      variant="outline"
                      leftSection={<IconDownload size={16} />}
                      onClick={handleInstallDefaults}
                    >
                      Install Defaults
                    </Button>
                    <Button
                      leftSection={<IconPlus size={16} />}
                      onClick={openInstallModal}
                    >
                      Install Bot
                    </Button>
                  </Group>
                </Group>

                {/* Bot System Status */}
                {botExecutorStatus && !botExecutorStatus.healthy && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="yellow"
                    title="Bot System Issue Detected"
                  >
                    <Stack gap="sm">
                      <Text size="sm">
                        Some bots are not loaded into the executor. This can happen if the database
                        wasn't ready when the server started. Bots that are not loaded cannot process
                        commands or be configured.
                      </Text>
                      <Group gap="xs">
                        {botExecutorStatus.bots
                          .filter(bot => bot.isEnabled && !bot.isRegistered)
                          .map(bot => (
                            <Badge key={bot.botId} color="red" variant="light">
                              {bot.name}: Not Loaded
                            </Badge>
                          ))}
                      </Group>
                      <Button
                        size="sm"
                        variant="filled"
                        color="yellow"
                        leftSection={<IconRefresh size={16} />}
                        onClick={handleReloadBots}
                        loading={reloadingBots}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Reload All Bots
                      </Button>
                    </Stack>
                  </Alert>
                )}

                {botExecutorStatus && botExecutorStatus.healthy && (
                  <Alert icon={<IconCheck size={16} />} color="green" title="Bot System Healthy">
                    <Text size="sm">
                      All {botExecutorStatus.registeredCount} enabled bot(s) are loaded and ready.
                    </Text>
                  </Alert>
                )}

                {/* Error display */}
                {botsError && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red">
                    {botsError}
                  </Alert>
                )}

                {/* Bots table */}
                <Stack gap="md">
                  <Group justify="space-between">
                    <Title order={4}>Installed Bots ({bots.length})</Title>
                    <ActionIcon
                      variant="subtle"
                      size="lg"
                      onClick={fetchBots}
                      loading={botsLoading}
                    >
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Group>

                  {botsLoading ? (
                    <Stack align="center" gap="md" py="xl">
                      <Loader size="lg" />
                      <Text>Loading bots...</Text>
                    </Stack>
                  ) : bots.length === 0 ? (
                    <Stack align="center" gap="md" py="xl">
                      <IconRobot size={48} color="gray" />
                      <Text c="dimmed">No bots installed</Text>
                      <Button
                        variant="light"
                        leftSection={<IconPlus size={16} />}
                        onClick={openInstallModal}
                      >
                        Install Your First Bot
                      </Button>
                    </Stack>
                  ) : (
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Bot</Table.Th>
                          <Table.Th>Version</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Installed</Table.Th>
                          <Table.Th style={{width: 100}}>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {bots.map((bot) => (
                          <Table.Tr key={bot.id}>
                            <Table.Td>
                              <Stack gap={2}>
                                <Group gap="xs">
                                  <Text fw={500}>{bot.name}</Text>
                                  {bot.isDefault && (
                                    <Badge size="xs" color="blue">Default</Badge>
                                  )}
                                  {bot.isRequired && (
                                    <Badge size="xs" color="red">Required</Badge>
                                  )}
                                </Group>
                                <Text size="xs" c="dimmed">{bot.description}</Text>
                                <Text size="xs" c="dimmed">by {bot.author.name}</Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{bot.version}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Switch
                                checked={bot.isEnabled}
                                disabled={bot.isRequired}
                                onChange={(event) => 
                                  handleToggleBot(bot.botId, event.currentTarget.checked)
                                }
                                thumbIcon={
                                  bot.isEnabled ? (
                                    <IconPower size={12} color="white" />
                                  ) : (
                                    <IconPower size={12} color="gray" />
                                  )
                                }
                              />
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {new Date(bot.installedAt).toLocaleDateString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Menu shadow="md" width={200}>
                                <Menu.Target>
                                  <ActionIcon variant="subtle">
                                    <IconDots size={16} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Item
                                    leftSection={<IconSettings size={14} />}
                                    onClick={async () => {
                                      setSelectedBot(bot);
                                      setBotConfigTab('config');
                                      await Promise.all([
                                        fetchBotConfig(bot.botId),
                                        fetchBotFiles(bot.botId)
                                      ]);
                                      openConfigModal();
                                    }}
                                  >
                                    Configure
                                  </Menu.Item>
                                  <Menu.Item
                                    leftSection={<IconFileText size={14} />}
                                    onClick={() => handleViewBotHelp(bot)}
                                  >
                                    View Help
                                  </Menu.Item>
                                  {!bot.isRequired && (
                                    <>
                                      <Menu.Divider />
                                      <Menu.Item
                                        leftSection={<IconTrash size={14} />}
                                        color="red"
                                        onClick={() => handleUninstallBot(bot.botId)}
                                      >
                                        Uninstall
                                      </Menu.Item>
                                    </>
                                  )}
                                </Menu.Dropdown>
                              </Menu>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Stack>
              </Stack>
            </Card>
          </Tabs.Panel>

          {/* Users Tab */}
          <Tabs.Panel value="users">
            <Card shadow="sm" padding="lg" radius="md" mt="md">
              <Stack gap="xl">
                {/* Header */}
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs">
                    <Title order={3}>User Management</Title>
                    <Text c="dimmed">
                      Manage users, roles, and permissions
                    </Text>
                  </Stack>
                  <Group>
                    <TextInput
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      leftSection={<IconUsers size={16} />}
                      style={{ width: 200 }}
                    />
                    <Select
                      placeholder="Filter by role"
                      value={roleFilter}
                      onChange={(value) => setRoleFilter(value || 'all')}
                      data={[
                        { value: 'all', label: 'All Users' },
                        { value: 'ADMIN', label: 'Admins' },
                        { value: 'EDITOR_IN_CHIEF', label: 'Editors-in-Chief' },
                        { value: 'USER', label: 'Users' }
                      ]}
                      style={{ width: 150 }}
                    />
                    <ActionIcon
                      variant="subtle"
                      size="lg"
                      onClick={fetchUsers}
                      loading={usersLoading}
                    >
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Group>
                </Group>

                {/* Error display */}
                {usersError && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red">
                    {usersError}
                  </Alert>
                )}

                {/* Users table */}
                <Stack gap="md">
                  <Group justify="space-between">
                    <Title order={4}>
                      Users ({users.length})
                      {roleFilter !== 'all' && (
                        <Badge ml="xs" size="sm" variant="light">
                          {roleFilter === 'EDITOR_IN_CHIEF' ? 'Editors' : `${roleFilter}s`}
                        </Badge>
                      )}
                    </Title>
                  </Group>

                  {usersLoading ? (
                    <Stack align="center" gap="md" py="xl">
                      <Loader size="lg" />
                      <Text>Loading users...</Text>
                    </Stack>
                  ) : users.length === 0 ? (
                    <Stack align="center" gap="md" py="xl">
                      <IconUsers size={48} color="gray" />
                      <Text c="dimmed">
                        {searchTerm || roleFilter !== 'all' ? 'No users found matching your criteria' : 'No users found'}
                      </Text>
                    </Stack>
                  ) : (
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>User</Table.Th>
                          <Table.Th>Role</Table.Th>
                          <Table.Th>Manuscripts</Table.Th>
                          <Table.Th>Reviews</Table.Th>
                          <Table.Th style={{width: 100}}>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {users.map((usr) => (
                          <Table.Tr key={usr.id}>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text fw={500}>{usr.name || usr.email}</Text>
                                {usr.name && (
                                  <Text size="xs" c="dimmed">{usr.email}</Text>
                                )}
                                {usr.affiliation && (
                                  <Text size="xs" c="dimmed">{usr.affiliation}</Text>
                                )}
                                {usr.orcidId && (
                                  <Text size="xs" c="dimmed">ORCID: {usr.orcidId}</Text>
                                )}
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Badge 
                                color={
                                  usr.role === 'ADMIN' ? 'red' : 
                                  usr.role === 'EDITOR_IN_CHIEF' ? 'blue' : 'gray'
                                }
                                variant="light"
                              >
                                {usr.role}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {usr._count?.manuscript_authors || 0}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {usr._count?.reviewAssignments || 0}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Menu shadow="md" width={200}>
                                <Menu.Target>
                                  <ActionIcon variant="subtle">
                                    <IconDots size={16} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Label>Role Management</Menu.Label>
                                  {usr.role === 'USER' && (
                                    <>
                                      <Menu.Item
                                        onClick={() => handleChangeUserRole(usr.id, 'ADMIN')}
                                      >
                                        Make Admin
                                      </Menu.Item>
                                      <Menu.Item
                                        onClick={() => handleChangeUserRole(usr.id, 'EDITOR_IN_CHIEF')}
                                      >
                                        Make Editor-in-Chief
                                      </Menu.Item>
                                    </>
                                  )}
                                  {usr.role === 'ADMIN' && (
                                    <Menu.Item
                                      onClick={() => handleChangeUserRole(usr.id, 'USER')}
                                      color="orange"
                                    >
                                      Remove Admin Role
                                    </Menu.Item>
                                  )}
                                  {usr.role === 'EDITOR_IN_CHIEF' && (
                                    <Menu.Item
                                      onClick={() => handleChangeUserRole(usr.id, 'USER')}
                                      color="orange"
                                    >
                                      Remove Editor-in-Chief Role
                                    </Menu.Item>
                                  )}
                                </Menu.Dropdown>
                              </Menu>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Stack>
              </Stack>
            </Card>
          </Tabs.Panel>
        </Tabs>

        {/* Install Bot Modal */}
        <Modal
          opened={installModalOpened}
          onClose={closeInstallModal}
          title="Install Bot"
          size="md"
        >
          <Stack gap="md">
            <Select
              label="Installation Source"
              value={installForm.type}
              onChange={(value) => setInstallForm({ ...installForm, type: value as any })}
              data={[
                { value: 'npm', label: 'npm Package' },
                { value: 'git', label: 'Git Repository' },
                { value: 'url', label: 'URL (tar.gz)' },
                { value: 'local', label: 'Local Path' }
              ]}
            />

            {installForm.type === 'npm' && (
              <>
                <TextInput
                  label="Package Name"
                  placeholder="@colloquium/my-bot"
                  value={installForm.packageName}
                  onChange={(e) => setInstallForm({ ...installForm, packageName: e.target.value })}
                  required
                />
                <TextInput
                  label="Version (optional)"
                  placeholder="1.0.0"
                  value={installForm.version}
                  onChange={(e) => setInstallForm({ ...installForm, version: e.target.value })}
                />
              </>
            )}

            {(installForm.type === 'git' || installForm.type === 'url') && (
              <>
                <TextInput
                  label="URL"
                  placeholder="https://github.com/user/bot.git"
                  value={installForm.url}
                  onChange={(e) => setInstallForm({ ...installForm, url: e.target.value })}
                  required
                />
                {installForm.type === 'git' && (
                  <TextInput
                    label="Branch/Tag (optional)"
                    placeholder="main"
                    value={installForm.ref}
                    onChange={(e) => setInstallForm({ ...installForm, ref: e.target.value })}
                  />
                )}
              </>
            )}

            {installForm.type === 'local' && (
              <TextInput
                label="Local Path"
                placeholder="/path/to/bot"
                value={installForm.path}
                onChange={(e) => setInstallForm({ ...installForm, path: e.target.value })}
                required
              />
            )}

            <Group justify="flex-end" gap="xs">
              <Button variant="outline" onClick={closeInstallModal}>
                Cancel
              </Button>
              <Button onClick={handleInstallBot}>
                Install
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Configure Bot Modal */}
        <Modal
          opened={configModalOpened}
          onClose={closeConfigModal}
          title={`Configure ${selectedBot?.name}`}
          size="calc(100vw - 3rem)"
          styles={{
            content: {
              height: 'calc(100vh - 8rem)',
              maxHeight: 'calc(100vh - 8rem)'
            },
            body: {
              height: 'calc(100vh - 12rem)',
              display: 'flex',
              flexDirection: 'column'
            }
          }}
        >
          <Tabs value={botConfigTab} onChange={setBotConfigTab} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Tabs.List>
              <Tabs.Tab value="config" leftSection={<IconCode size={16} />}>
                Configuration
              </Tabs.Tab>
              {selectedBot?.supportsFileUploads && (
                <Tabs.Tab value="files" leftSection={<IconFile size={16} />}>
                  Files ({botFiles.length})
                </Tabs.Tab>
              )}
              {selectedBot?.botId === 'bot-markdown-renderer' && (
                <Tabs.Tab value="templates" leftSection={<IconFileText size={16} />}>
                  Built-in Templates
                </Tabs.Tab>
              )}
            </Tabs.List>

            <Tabs.Panel value="config" pt="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Stack gap="md" style={{ height: '100%' }}>
                <Text size="sm" c="dimmed">
                  Update the YAML configuration for {selectedBot?.name}. Comments (# lines) are preserved and encouraged.
                </Text>
                
                <YamlInput
                  label="YAML Configuration"
                  placeholder="# Enter YAML configuration here..."
                  value={configForm}
                  onChange={setConfigForm}
                  minRows={15}
                  maxRows={30}
                  validationError="Invalid YAML"
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      minHeight: '400px'
                    }
                  }}
                />

                <Group justify="flex-end" gap="xs">
                  <Button variant="outline" onClick={closeConfigModal}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfigureBot}>
                    Save Configuration
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            {selectedBot?.supportsFileUploads && (
              <Tabs.Panel value="files" pt="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Stack gap="md" style={{ height: '100%' }}>
                  <Text size="sm" c="dimmed">
                    Upload and manage configuration files for {selectedBot?.name}.
                  </Text>

                  {selectedBot?.botId === 'bot-markdown-renderer' && (
                    <Card withBorder p="md" bg="green.0">
                      <Stack gap="xs">
                        <Text size="sm" fw={500} c="green">
                          Markdown Renderer Bot Files
                        </Text>
                        <Text size="xs" c="dimmed">
                          Built-in templates are automatically uploaded when the bot is installed. You can also upload custom files:
                        </Text>
                        <List size="xs" c="dimmed">
                          <List.Item>
                            <strong>HTML Templates</strong> (.html): Custom document templates for HTML output
                          </List.Item>
                          <List.Item>
                            <strong>LaTeX Templates</strong> (.tex): Custom document templates for PDF output
                          </List.Item>
                          <List.Item>
                            <strong>Typst Templates</strong> (.typ): Custom document templates for Typst output
                          </List.Item>
                          <List.Item>
                            <strong>CSS Files</strong> (.css): Custom styling for HTML templates
                          </List.Item>
                          <List.Item>
                            <strong>JSON Configuration</strong> (.json): Template metadata and configuration
                          </List.Item>
                          <List.Item>
                            <strong>Images</strong> (.png, .jpg, .svg): Logos, headers, and other template assets
                          </List.Item>
                        </List>
                      </Stack>
                    </Card>
                  )}

                {/* File Upload Section */}
                <Card withBorder p="md">
                  <Stack gap="md">
                    <Title order={5}>Upload New File</Title>
                    
                    <FileInput
                      label="Select File"
                      placeholder="Choose a file to upload"
                      value={fileToUpload}
                      onChange={setFileToUpload}
                      leftSection={<IconUpload size={16} />}
                      accept=".html,.css,.js,.json,.png,.jpg,.jpeg,.gif,.svg,.txt"
                    />

                    <TextInput
                      label="Description (optional)"
                      placeholder="File description"
                      value={fileDescription}
                      onChange={(e) => setFileDescription(e.target.value)}
                    />

                    {isUploading && (
                      <Box>
                        <Text size="sm" mb="xs">Uploading...</Text>
                        <Progress value={uploadProgress} />
                      </Box>
                    )}

                    <Group justify="flex-end">
                      <Button
                        onClick={handleFileUpload}
                        disabled={!fileToUpload || isUploading}
                        loading={isUploading}
                        leftSection={<IconUpload size={16} />}
                      >
                        Upload File
                      </Button>
                    </Group>
                  </Stack>
                </Card>

                {/* Files List */}
                <Card withBorder p="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Stack gap="md" style={{ height: '100%' }}>
                    <Title order={5}>Uploaded Files</Title>
                    
                    {botFiles.length === 0 ? (
                      <Text size="sm" c="dimmed" ta="center" py="xl">
                        No files uploaded yet
                      </Text>
                    ) : (
                      <Box style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                        <List spacing="sm">
                        {botFiles.map((file) => (
                          <List.Item
                            key={file.id}
                            icon={
                              <ThemeIcon size={24} radius="xl" variant="light">
                                <IconFileText size={14} />
                              </ThemeIcon>
                            }
                          >
                            <Group justify="space-between" align="flex-start">
                              <Stack gap={2}>
                                {editingFileId === file.id ? (
                                  <Group gap="xs">
                                    <TextInput
                                      size="xs"
                                      value={editingFileName}
                                      onChange={(e) => setEditingFileName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleRenameFile(file.id, editingFileName);
                                        } else if (e.key === 'Escape') {
                                          setEditingFileId(null);
                                          setEditingFileName('');
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <ActionIcon
                                      size="sm"
                                      variant="subtle"
                                      color="green"
                                      onClick={() => handleRenameFile(file.id, editingFileName)}
                                    >
                                      <IconDeviceFloppy size={12} />
                                    </ActionIcon>
                                    <ActionIcon
                                      size="sm"
                                      variant="subtle"
                                      color="gray"
                                      onClick={() => {
                                        setEditingFileId(null);
                                        setEditingFileName('');
                                      }}
                                    >
                                      <IconX size={12} />
                                    </ActionIcon>
                                  </Group>
                                ) : (
                                  <Text fw={500}>{file.filename}</Text>
                                )}
                                {file.description && (
                                  <Text size="xs" c="dimmed">
                                    {file.description}
                                  </Text>
                                )}
                                <Text size="xs" c="dimmed">
                                  {(file.size / 1024).toFixed(1)} KB • {file.mimetype} • 
                                  Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                                </Text>
                              </Stack>
                              {editingFileId !== file.id && (
                                <Group gap="xs">
                                  <Button
                                    size="xs"
                                    variant="subtle"
                                    component="a"
                                    href={`http://localhost:4000${file.downloadUrl}`}
                                    target="_blank"
                                    leftSection={<IconDownload size={12} />}
                                  >
                                    Download
                                  </Button>
                                  <ActionIcon
                                    size="sm"
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => {
                                      setEditingFileId(file.id);
                                      setEditingFileName(file.filename);
                                    }}
                                  >
                                    <IconEdit size={12} />
                                  </ActionIcon>
                                  <ActionIcon
                                    size="sm"
                                    variant="subtle"
                                    color="red"
                                    onClick={() => handleDeleteFile(file.id)}
                                  >
                                    <IconX size={12} />
                                  </ActionIcon>
                                </Group>
                              )}
                            </Group>
                          </List.Item>
                        ))}
                        </List>
                      </Box>
                    )}
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>
            )}

            {selectedBot?.botId === 'bot-markdown-renderer' && (
              <Tabs.Panel value="templates" pt="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Stack gap="md" style={{ height: '100%' }}>
                  <Text size="sm" c="dimmed">
                    Template configuration for the Markdown Renderer Bot showing explicit file mappings.
                  </Text>

                  <Stack gap="md" style={{ flex: 1, overflowY: 'auto' }}>
                    {(() => {
                      const markdownBot = bots.find(bot => bot.botId === 'bot-markdown-renderer');
                      const config = markdownBot?.config;
                      
                      if (!config?.templates || Object.keys(config.templates).length === 0) {
                        return (
                          <Alert color="yellow">
                            <Text size="sm">
                              No templates configured yet. The templates will be automatically configured when the bot is reinstalled or during the next server restart.
                            </Text>
                          </Alert>
                        );
                      }

                      return Object.entries(config.templates).map(([templateName, template]: [string, any]) => (
                        <Card key={templateName} withBorder p="md">
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text fw={500}>{template.title || templateName}</Text>
                              <Badge size="sm" color={
                                template.metadata?.type === 'academic' ? 'green' :
                                template.metadata?.type === 'journal' ? 'purple' :
                                'blue'
                              }>
                                {template.metadata?.type || 'Template'}
                              </Badge>
                            </Group>
                            
                            <Text size="sm" c="dimmed">
                              {template.description}
                            </Text>
                            
                            <Text size="xs" c="dimmed">
                              Default Engine: {template.defaultEngine || 'html'}
                            </Text>
                            
                            {template.files && template.files.length > 0 && (
                              <Box>
                                <Text size="xs" fw={500} mb={4}>Template Files:</Text>
                                <Stack gap={2}>
                                  {template.files.map((file: any, index: number) => (
                                    <Group key={index} gap="xs">
                                      <Badge size="xs" variant="light" color={
                                        file.engine === 'html' ? 'blue' :
                                        file.engine === 'latex' ? 'green' :
                                        file.engine === 'typst' ? 'purple' :
                                        'gray'
                                      }>
                                        {file.engine}
                                      </Badge>
                                      <Text size="xs" c="dimmed">{file.filename}</Text>
                                      <Text size="xs" c="dimmed" opacity={0.7}>
                                        (ID: {file.fileId.substring(0, 8)}...)
                                      </Text>
                                    </Group>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                            
                            <Text size="xs" c="dimmed">
                              Usage: <code>@bot-markdown-renderer render template="{templateName}"</code>
                            </Text>
                          </Stack>
                        </Card>
                      ));
                    })()}

                    <Card withBorder p="md" bg="orange.0">
                      <Stack gap="xs">
                        <Text size="sm" fw={500} c="orange">
                          Custom Templates
                        </Text>
                        <Text size="xs" c="dimmed">
                          You can upload custom templates using the "Files" tab above. Template files should follow the folder-based naming convention:
                        </Text>
                        <List size="xs" c="dimmed">
                          <List.Item><code>template-name/template.html</code> for HTML templates</List.Item>
                          <List.Item><code>template-name/template.tex</code> for LaTeX templates</List.Item>
                          <List.Item><code>template-name/template.typ</code> for Typst templates</List.Item>
                          <List.Item><code>template-name/template.json</code> for template metadata</List.Item>
                        </List>
                      </Stack>
                    </Card>
                  </Stack>
                </Stack>
              </Tabs.Panel>
            )}
          </Tabs>
        </Modal>

        {/* Help Modal */}
        <Modal
          opened={helpModalOpened}
          onClose={closeHelpModal}
          title={`Help: ${selectedBot?.name}`}
          size="calc(100vw - 3rem)"
          styles={{
            content: {
              height: 'calc(100vh - 8rem)',
              maxHeight: 'calc(100vh - 8rem)'
            },
            body: {
              height: 'calc(100vh - 12rem)',
              display: 'flex',
              flexDirection: 'column'
            }
          }}
        >
          <Box
            className="bot-help-content"
            style={{ height: '100%', overflow: 'auto' }}
            dangerouslySetInnerHTML={{
              __html: botHelpContent.startsWith('Loading') || botHelpContent.startsWith('Failed')
                ? `<p>${botHelpContent}</p>`
                : parseMarkdown(botHelpContent)
            }}
          />
          <style>{`
            .bot-help-content {
              font-size: 14px;
              line-height: 1.6;
            }
            .bot-help-content h1,
            .bot-help-content h2,
            .bot-help-content h3,
            .bot-help-content h4,
            .bot-help-content h5,
            .bot-help-content h6 {
              margin-top: 1em;
              margin-bottom: 0.5em;
              font-weight: 600;
            }
            .bot-help-content h1 { font-size: 1.5em; }
            .bot-help-content h2 { font-size: 1.3em; }
            .bot-help-content h3 { font-size: 1.1em; }
            .bot-help-content p { margin: 0.5em 0; }
            .bot-help-content ul,
            .bot-help-content ol {
              margin: 0.5em 0;
              padding-left: 1.5em;
            }
            .bot-help-content li { margin: 0.25em 0; }
            .bot-help-content code {
              padding: 2px 4px;
              border-radius: 3px;
              background-color: var(--mantine-color-gray-1);
              font-family: Monaco, Consolas, 'Courier New', monospace;
              font-size: 0.9em;
              border: 1px solid var(--mantine-color-gray-3);
            }
            .bot-help-content pre {
              margin: 0.5em 0;
              padding: 1em;
              border-radius: 6px;
              background-color: var(--mantine-color-gray-1);
              overflow: auto;
            }
            .bot-help-content pre code {
              padding: 0;
              background-color: transparent;
              border: none;
            }
            .bot-help-content blockquote {
              margin: 0.5em 0;
              padding: 0.5em 1em;
              border-left: 4px solid var(--mantine-color-gray-4);
              background-color: var(--mantine-color-gray-0);
              font-style: italic;
            }
            .bot-help-content a {
              color: var(--mantine-color-blue-6);
              text-decoration: none;
            }
            .bot-help-content a:hover {
              text-decoration: underline;
            }
            .bot-help-content table {
              border-collapse: collapse;
              width: 100%;
              margin: 0.5em 0;
            }
            .bot-help-content th,
            .bot-help-content td {
              border: 1px solid var(--mantine-color-gray-3);
              padding: 8px 12px;
              text-align: left;
            }
            .bot-help-content th {
              background-color: var(--mantine-color-gray-1);
              font-weight: 600;
            }
          `}</style>
        </Modal>
      </Stack>
    </Container>
  );
}