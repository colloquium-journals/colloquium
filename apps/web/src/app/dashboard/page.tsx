'use client';

import { Title, Grid, Stack } from '@mantine/core';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { ManuscriptOverview } from '@/components/dashboard/ManuscriptOverview';
import { ActiveConversations } from '@/components/dashboard/ActiveConversations';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { EditorRoute } from '@/components/auth/ProtectedRoute';

export default function DashboardPage() {
  return (
    <EditorRoute>
      <Stack gap="xl" py="xl">
          <Title order={1}>Dashboard</Title>
          
          {/* Overview Cards */}
          <OverviewCards />
          
          {/* Main Content Grid */}
          <Grid>
            {/* Left Column */}
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="lg">
                <ManuscriptOverview />
                <ActiveConversations />
              </Stack>
            </Grid.Col>
            
            {/* Right Column */}
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="lg">
                <QuickActions />
                <RecentActivity />
              </Stack>
            </Grid.Col>
          </Grid>
        </Stack>
    </EditorRoute>
  );
}