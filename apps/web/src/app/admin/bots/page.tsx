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
  Badge,
  Modal,
  TextInput,
  Select,
  Textarea,
  Switch,
  Alert,
  Loader,
  Table,
  ActionIcon,
  Menu,
  Divider,
  JsonInput
} from '@mantine/core';
import {
  IconPlus,
  IconSettings,
  IconTrash,
  IconRefresh,
  IconPower,
  IconPowerOff,
  IconDots,
  IconAlertCircle,
  IconCheck,
  IconRobot,
  IconDownload,
  IconCode
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

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
  installedAt: string;
  updatedAt: string;
  packageName: string;
}

export default function BotManagementPage() {
  const { user, isAuthenticated } = useAuth();
  const [bots, setBots] = useState<BotInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [installModalOpened, { open: openInstallModal, close: closeInstallModal }] = useDisclosure(false);
  const [configModalOpened, { open: openConfigModal, close: closeConfigModal }] = useDisclosure(false);
  const [selectedBot, setSelectedBot] = useState<BotInstallation | null>(null);
  
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

  // Check if user is admin
  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Admin access required to manage bots.
        </Alert>
      </Container>
    );
  }

  // Fetch installed bots
  const fetchBots = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:4000/api/bot-management', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bots');
      }

      const data = await response.json();
      setBots(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

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

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading bots...</Text>
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
            <Title order={1}>Bot Management</Title>
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
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {error}
          </Alert>
        )}

        {/* Bots table */}
        <Card shadow="sm" padding="lg" radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>Installed Bots ({bots.length})</Title>
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={fetchBots}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>

            {bots.length === 0 ? (
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
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Installed</Table.Th>
                    <Table.Th width={100}>Actions</Table.Th>
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
                          </Group>
                          <Text size="xs" c="dimmed">{bot.description}</Text>
                          <Text size="xs" c="dimmed">by {bot.author.name}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{bot.version}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray">
                          {bot.category || 'utility'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Switch
                          checked={bot.isEnabled}
                          onChange={(event) => 
                            handleToggleBot(bot.botId, event.currentTarget.checked)
                          }
                          thumbIcon={
                            bot.isEnabled ? (
                              <IconPower size={12} color="white" />
                            ) : (
                              <IconPowerOff size={12} color="gray" />
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
                              onClick={() => {
                                setSelectedBot(bot);
                                setConfigForm('{}');
                                openConfigModal();
                              }}
                            >
                              Configure
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={() => handleUninstallBot(bot.botId)}
                            >
                              Uninstall
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Card>

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
          size="lg"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Update the configuration for {selectedBot?.name}. Configuration must be valid JSON.
            </Text>
            
            <JsonInput
              label="Configuration"
              placeholder="{\n  \"key\": \"value\"\n}"
              value={configForm}
              onChange={setConfigForm}
              minRows={8}
              maxRows={16}
              validationError="Invalid JSON"
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
        </Modal>
      </Stack>
    </Container>
  );
}