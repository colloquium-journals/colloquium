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
  JsonInput,
  List,
  ThemeIcon,
  Box,
  Progress
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
  IconEdit
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { useJournalSettings } from '@/contexts/JournalSettingsContext';

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
    authoredManuscripts: number;
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
  allowedFileTypes: string[];
  requireOrcid: boolean;
  
  // Review Settings
  defaultReviewPeriod: number; // in days
  allowPublicReviews: boolean;
  requireReviewerRegistration: boolean;
  
  // Publication Settings
  issn?: string;
  doi?: string;
  licenseType: string;
  copyrightHolder: string;
  
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
    allowedFileTypes: ['pdf', 'docx', 'tex', 'zip'],
    requireOrcid: false,
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
  const [activeTab, setActiveTab] = useState<string | null>('basic');

  // Bot management state
  const [bots, setBots] = useState<BotInstallation[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsError, setBotsError] = useState<string | null>(null);
  
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
  const [configForm, setConfigForm] = useState('{}');
  
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
    return botId === 'editorial-bot';
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

  // Fetch bots when switching to bots tab
  useEffect(() => {
    if (activeTab === 'bots') {
      fetchBots();
    }
  }, [activeTab]);

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

      // Refresh the global settings context
      await refreshSettings();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save settings',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
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

  // Configure bot
  const handleConfigureBot = async () => {
    if (!selectedBot) return;

    try {
      const config = JSON.parse(configForm);
      
      const response = await fetch(`http://localhost:4000/api/bot-management/${selectedBot.botId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config })
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
  const handleChangeUserRole = async (userId: string, newRole: 'ADMIN' | 'EDITOR' | 'USER') => {
    try {
      // Map frontend roles to backend roles
      const roleMapping = {
        'ADMIN': 'ADMIN',
        'EDITOR': 'EDITOR', 
        'USER': 'AUTHOR'
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
  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Admin access required to manage journal settings.
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
            <Tabs.Tab value="basic" leftSection={<IconSettings size={16} />}>
              Basic Info
            </Tabs.Tab>
            <Tabs.Tab value="appearance" leftSection={<IconPalette size={16} />}>
              Appearance
            </Tabs.Tab>
            <Tabs.Tab value="submissions" leftSection={<IconUsers size={16} />}>
              Submissions
            </Tabs.Tab>
            <Tabs.Tab value="publishing" leftSection={<IconWorld size={16} />}>
              Publishing
            </Tabs.Tab>
            <Tabs.Tab value="email" leftSection={<IconMail size={16} />}>
              Email
            </Tabs.Tab>
            <Tabs.Tab value="advanced" leftSection={<IconShield size={16} />}>
              Advanced
            </Tabs.Tab>
            <Tabs.Tab value="bots" leftSection={<IconRobot size={16} />}>
              Bots
            </Tabs.Tab>
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

                <Switch
                  label="Require ORCID"
                  description="Require authors to provide ORCID iD"
                  checked={settings.requireOrcid}
                  onChange={(e) => setSettings({ ...settings, requireOrcid: e.currentTarget.checked })}
                />

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

                <Divider label="Theme Settings" />

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
                      { value: 'light', label: 'Light Theme' },
                      { value: 'dark', label: 'Dark Theme' },
                      { value: 'auto', label: 'Auto (Follow System)' }
                    ]}
                  />
                )}
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
                                      setConfigForm('{}');
                                      setBotConfigTab('config');
                                      await fetchBotFiles(bot.botId);
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
                        { value: 'EDITOR_IN_CHIEF', label: 'Editors' },
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
                                {usr.role === 'EDITOR_IN_CHIEF' ? 'EDITOR' : usr.role}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {usr._count?.authoredManuscripts || 0}
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
                                        onClick={() => handleChangeUserRole(usr.id, 'EDITOR')}
                                      >
                                        Make Editor
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
                                      Remove Editor Role
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
            </Tabs.List>

            <Tabs.Panel value="config" pt="md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Stack gap="md" style={{ height: '100%' }}>
                <Text size="sm" c="dimmed">
                  Update the configuration for {selectedBot?.name}. Configuration must be valid JSON.
                </Text>
                
                <JsonInput
                  label="Configuration"
                  placeholder={'{\n  "key": "value"\n}'}
                  value={configForm}
                  onChange={setConfigForm}
                  minRows={15}
                  maxRows={30}
                  validationError="Invalid JSON"
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      minHeight: '400px',
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      fontSize: '14px',
                      lineHeight: '1.5'
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
          <Box style={{ height: '100%', overflow: 'auto' }}>
            <Text 
              component="pre"
              style={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                fontSize: '14px'
              }}
            >
              {botHelpContent}
            </Text>
          </Box>
        </Modal>
      </Stack>
    </Container>
  );
}