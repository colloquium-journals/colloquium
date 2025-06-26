import { FileNode } from '@/components/files/FileTreeView';

export interface FileWithPath extends File {
  webkitRelativePath: string;
}

export function buildFileTree(files: File[]): FileNode[] {
  // Convert files to FileWithPath format
  const filesWithPath = files.map(file => {
    const fileWithPath = file as FileWithPath;
    if (!fileWithPath.webkitRelativePath) {
      (fileWithPath as any).webkitRelativePath = file.name;
    }
    return fileWithPath;
  });
  const root: { [key: string]: FileNode } = {};
  
  filesWithPath.forEach((file, index) => {
    const path = file.webkitRelativePath || file.name;
    const parts = path.split('/').filter(Boolean);
    
    let currentLevel = root;
    let currentPath = '';
    
    // Build the folder structure
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      
      if (!currentLevel[folderName]) {
        currentLevel[folderName] = {
          id: `folder-${currentPath}`,
          name: folderName,
          path: currentPath,
          type: 'folder',
          children: []
        };
      }
      
      // Navigate to the children of this folder
      if (!currentLevel[folderName].children) {
        currentLevel[folderName].children = [];
      }
      
      // Convert children array to object for easier manipulation
      const childrenAsObject: { [key: string]: FileNode } = {};
      currentLevel[folderName].children!.forEach(child => {
        childrenAsObject[child.name] = child;
      });
      
      currentLevel = childrenAsObject;
    }
    
    // Add the file
    const fileName = parts[parts.length - 1];
    const fullPath = path;
    
    currentLevel[fileName] = {
      id: `file-${index}-${fullPath}`,
      name: fileName,
      path: fullPath,
      type: 'file',
      size: file.size,
      mimetype: file.type,
      file: file
    };
  });
  
  // Convert the nested object structure back to arrays
  function convertToArray(obj: { [key: string]: FileNode }): FileNode[] {
    return Object.values(obj).map(node => {
      if (node.type === 'folder' && node.children) {
        // Convert children back to array format
        const childrenAsObject: { [key: string]: FileNode } = {};
        node.children.forEach(child => {
          childrenAsObject[child.name] = child;
        });
        
        node.children = convertToArray(childrenAsObject);
      }
      return node;
    }).sort((a, b) => {
      // Sort folders first, then files
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
  }
  
  return convertToArray(root);
}

export function flattenFileTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  
  function traverse(node: FileNode) {
    if (node.type === 'file') {
      result.push(node);
    }
    
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  nodes.forEach(traverse);
  return result;
}

export function removeNodeFromTree(nodes: FileNode[], pathToRemove: string): FileNode[] {
  return nodes.map(node => {
    if (node.path === pathToRemove) {
      return null; // Mark for removal
    }
    
    if (node.children) {
      node.children = removeNodeFromTree(node.children, pathToRemove);
    }
    
    return node;
  }).filter(Boolean) as FileNode[];
}

export function findNodeInTree(nodes: FileNode[], path: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    
    if (node.children) {
      const found = findNodeInTree(node.children, path);
      if (found) return found;
    }
  }
  
  return null;
}

// Get all files from the tree as File objects
export function getFilesFromTree(nodes: FileNode[]): File[] {
  const files: File[] = [];
  
  function traverse(node: FileNode) {
    if (node.type === 'file' && node.file) {
      files.push(node.file);
    }
    
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  nodes.forEach(traverse);
  return files;
}