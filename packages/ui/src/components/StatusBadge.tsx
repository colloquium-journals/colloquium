import React from 'react';
import { Badge } from '@mantine/core';
import { ManuscriptStatus } from '@colloquium/types';

export interface StatusBadgeProps {
  status: ManuscriptStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const getStatusConfig = (status: ManuscriptStatus) => {
  switch (status) {
    case 'SUBMITTED':
      return { color: 'blue', label: 'Submitted' };
    case 'UNDER_REVIEW':
      return { color: 'orange', label: 'Under Review' };
    case 'REVISION_REQUESTED':
      return { color: 'yellow', label: 'Revision Requested' };
    case 'REVISED':
      return { color: 'cyan', label: 'Revised' };
    case 'ACCEPTED':
      return { color: 'green', label: 'Accepted' };
    case 'REJECTED':
      return { color: 'red', label: 'Rejected' };
    case 'PUBLISHED':
      return { color: 'violet', label: 'Published' };
    default:
      return { color: 'gray', label: status };
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'sm' 
}) => {
  const { color, label } = getStatusConfig(status);
  
  return (
    <Badge color={color} size={size} variant="light">
      {label}
    </Badge>
  );
};