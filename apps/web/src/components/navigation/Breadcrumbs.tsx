'use client';

import { Breadcrumbs as MantineBreadcrumbs, Anchor } from '@mantine/core';
import { IconHome } from '@tabler/icons-react';
import Link from 'next/link';

interface BreadcrumbItem {
  title: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const allItems = [
    { title: 'Home', href: '/' },
    ...items
  ];

  return (
    <MantineBreadcrumbs>
      {allItems.map((item, index) => (
        <span key={index}>
          {item.href && index < allItems.length - 1 ? (
            <Anchor component={Link} href={item.href} size="sm">
              {index === 0 ? <IconHome size={14} /> : item.title}
            </Anchor>
          ) : (
            <span style={{ fontSize: '14px', color: 'var(--mantine-color-dimmed)' }}>
              {index === 0 ? <IconHome size={14} /> : item.title}
            </span>
          )}
        </span>
      ))}
    </MantineBreadcrumbs>
  );
}