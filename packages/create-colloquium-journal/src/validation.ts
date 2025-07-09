export function validateJournalName(name: string): boolean | string {
  if (!name || name.trim().length === 0) {
    return 'Journal name is required';
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 3) {
    return 'Journal name must be at least 3 characters long';
  }
  
  if (trimmed.length > 100) {
    return 'Journal name must be less than 100 characters';
  }
  
  return true;
}

export function validateSlug(slug: string): boolean | string {
  if (!slug || slug.trim().length === 0) {
    return 'Journal slug is required';
  }
  
  const trimmed = slug.trim();
  
  if (!/^[a-z0-9\-]+$/.test(trimmed)) {
    return 'Journal slug must be lowercase alphanumeric with hyphens only';
  }
  
  if (trimmed.length < 3) {
    return 'Journal slug must be at least 3 characters long';
  }
  
  if (trimmed.length > 50) {
    return 'Journal slug must be less than 50 characters';
  }
  
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return 'Journal slug cannot start or end with hyphens';
  }
  
  if (trimmed.includes('--')) {
    return 'Journal slug cannot contain consecutive hyphens';
  }
  
  // Reserved slugs
  const reserved = [
    'api', 'admin', 'www', 'mail', 'ftp', 'localhost', 'test', 'staging', 'prod', 'production',
    'dev', 'development', 'beta', 'alpha', 'demo', 'example', 'sample', 'docs', 'help', 'support',
    'blog', 'news', 'about', 'contact', 'legal', 'privacy', 'terms', 'login', 'register', 'signup',
    'dashboard', 'profile', 'settings', 'account', 'user', 'users', 'auth', 'oauth', 'assets',
    'static', 'public', 'private', 'secure', 'cdn', 'media', 'uploads', 'downloads', 'files'
  ];
  
  if (reserved.includes(trimmed)) {
    return `Journal slug "${trimmed}" is reserved and cannot be used`;
  }
  
  return true;
}

export function validateEmail(email: string): boolean | string {
  if (!email || email.trim().length === 0) {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Invalid email format';
  }
  
  return true;
}

export function validateDomain(domain: string): boolean | string {
  if (!domain || domain.trim().length === 0) {
    return true; // Optional field
  }
  
  const trimmed = domain.trim();
  
  // Remove protocol if present
  const cleanDomain = trimmed.replace(/^https?:\/\//, '');
  
  if (cleanDomain.length > 253) {
    return 'Domain name too long';
  }
  
  // Basic domain validation - must have at least one dot
  if (!cleanDomain.includes('.')) {
    return 'Invalid domain format';
  }
  
  // More comprehensive domain validation
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!domainRegex.test(cleanDomain)) {
    return 'Invalid domain format';
  }
  
  // Check for valid TLD (at least 2 characters)
  const parts = cleanDomain.split('.');
  const tld = parts[parts.length - 1];
  if (tld.length < 2) {
    return 'Invalid domain format';
  }
  
  return true;
}

export function validateBotId(botId: string): boolean | string {
  if (!botId || botId.trim().length === 0) {
    return 'Bot ID is required';
  }
  
  const trimmed = botId.trim();
  
  if (!/^[a-z0-9\-]+$/.test(trimmed)) {
    return 'Bot ID must be lowercase alphanumeric with hyphens only';
  }
  
  if (trimmed.length < 3) {
    return 'Bot ID must be at least 3 characters long';
  }
  
  if (trimmed.length > 50) {
    return 'Bot ID must be less than 50 characters';
  }
  
  return true;
}