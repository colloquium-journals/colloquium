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
  Tabs
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
  IconShield
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

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
}

export default function JournalSettingsPage() {
  const { user, isAuthenticated } = useAuth();
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
    maintenanceMode: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('basic');

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

                <FileInput
                  label="Logo"
                  placeholder="Upload journal logo"
                  accept="image/*"
                  leftSection={<IconPhoto size={16} />}
                />
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
                  onChange={(value) => setSettings({ ...settings, maxFileSize: value || 50 })}
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
                  onChange={(value) => setSettings({ ...settings, defaultReviewPeriod: value || 30 })}
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
                        onChange={(value) => setSettings({ ...settings, smtpPort: value || 587 })}
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
        </Tabs>
      </Stack>
    </Container>
  );
}