'use client';

import { Spotlight, SpotlightActionData } from '@mantine/spotlight';
import { 
  IconHome, 
  IconFileText, 
  IconMessage, 
  IconPlus, 
  IconUser,
  IconSettings,
  IconSearch
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

interface SearchSpotlightProps {
  children: React.ReactNode;
}

export function SearchSpotlight({ children }: SearchSpotlightProps) {
  const router = useRouter();

  const actions: SpotlightActionData[] = [
    // Navigation
    {
      id: 'home',
      label: 'Home',
      description: 'Return to the homepage',
      onClick: () => router.push('/'),
      leftSection: <IconHome size={18} />,
      keywords: ['home', 'homepage', 'main']
    },
    {
      id: 'articles',
      label: 'Browse Articles',
      description: 'View published articles and research',
      onClick: () => router.push('/articles'),
      leftSection: <IconFileText size={18} />,
      keywords: ['manuscripts', 'papers', 'research', 'articles', 'publications']
    },
    {
      id: 'conversations',
      label: 'Conversations',
      description: 'View active discussions and reviews',
      onClick: () => router.push('/conversations'),
      leftSection: <IconMessage size={18} />,
      keywords: ['conversations', 'discussions', 'reviews', 'chat', 'messages']
    },
    
    // Quick Actions
    {
      id: 'submit',
      label: 'Submit Article',
      description: 'Submit a new article for review',
      onClick: () => router.push('/articles/submit'),
      leftSection: <IconPlus size={18} />,
      keywords: ['submit', 'upload', 'new', 'manuscript', 'paper', 'publish']
    },
    
    // Account
    {
      id: 'profile',
      label: 'Profile',
      description: 'Manage your profile and account settings',
      onClick: () => router.push('/profile'),
      leftSection: <IconUser size={18} />,
      keywords: ['profile', 'account', 'user', 'personal']
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure your preferences and settings',
      onClick: () => router.push('/settings'),
      leftSection: <IconSettings size={18} />,
      keywords: ['settings', 'preferences', 'config', 'options']
    },

    // Example manuscript searches (these would be dynamic in a real app)
    {
      id: 'ml-manuscript',
      label: 'Machine Learning Applications in Peer Review',
      description: 'Published manuscript by Dr. Sarah Johnson',
      onClick: () => router.push('/articles/cmbutx3fs0008qrgm7tirs6mu'),
      leftSection: <IconFileText size={18} />,
      keywords: ['machine learning', 'peer review', 'automation', 'sarah johnson']
    },
    {
      id: 'blockchain-manuscript',
      label: 'Blockchain Technology for Academic Publishing',
      description: 'Published manuscript by Prof. Elena Rodriguez',
      onClick: () => router.push('/articles/cmbutx3ft0009qrgm56763u0f'),
      leftSection: <IconFileText size={18} />,
      keywords: ['blockchain', 'transparency', 'publishing', 'elena rodriguez']
    },
    {
      id: 'open-science-manuscript',
      label: 'Open Science Platforms: A Comparative Analysis',
      description: 'Published manuscript by Dr. Robert Wilson',
      onClick: () => router.push('/articles/cmbutx3fv000aqrgmqs6fvbp1'),
      leftSection: <IconFileText size={18} />,
      keywords: ['open science', 'platforms', 'collaboration', 'robert wilson']
    }
  ];

  return (
    <Spotlight
      actions={actions}
      nothingFound="Nothing found..."
      highlightQuery
      searchProps={{
        leftSection: <IconSearch size={20} />,
        placeholder: 'Search manuscripts, conversations, or navigate...'
      }}
      shortcut={['mod + K']}
      limit={10}
    >
      {children}
    </Spotlight>
  );
}