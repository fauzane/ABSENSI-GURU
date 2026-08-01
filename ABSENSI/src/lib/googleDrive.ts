import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User logged in but token not cached in memory
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google OAuth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('SignIn error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

// Drive API REST Helpers
export async function listDriveFiles(accessToken: string, query?: string): Promise<DriveFile[]> {
  let q = "trashed = false";
  if (query && query.trim()) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,size,createdTime,webViewLink,webContentLink,iconLink,thumbnailLink)&q=${encodeURIComponent(q)}&orderBy=createdTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gagal mengambil berkas Drive (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

export async function uploadDriveFile(accessToken: string, file: File, parentFolderId?: string): Promise<DriveFile> {
  const metadata: any = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gagal mengunggah berkas (${res.status})`);
  }

  return await res.json();
}

export async function createDriveFolder(accessToken: string, folderName: string): Promise<DriveFile> {
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gagal membuat folder (${res.status})`);
  }

  return await res.json();
}

export async function ensureAppFolderStructure(accessToken: string): Promise<{
  rootFolderId: string;
  materiFolderId: string;
  laporanFolderId: string;
  backupFolderId: string;
}> {
  // 1. Check or create root folder
  let files = await listDriveFiles(accessToken, "SDM23_Surakarta_SIMPeg");
  let rootFolder = files.find(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === 'SDM23_Surakarta_SIMPeg');

  if (!rootFolder) {
    rootFolder = await createDriveFolder(accessToken, 'SDM23_Surakarta_SIMPeg');
  }

  // Helper to find or create subfolder under parent
  const findOrCreateSubfolder = async (folderName: string, parentId: string) => {
    const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) return data.files[0].id;
    }

    // Create subfolder
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    };
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    const createdData = await createRes.json();
    return createdData.id;
  };

  const materiFolderId = await findOrCreateSubfolder('Materi_dan_Jurnal_Mengajar', rootFolder.id);
  const laporanFolderId = await findOrCreateSubfolder('Laporan_Izin_dan_SK', rootFolder.id);
  const backupFolderId = await findOrCreateSubfolder('Backup_Database_Sistem', rootFolder.id);

  return {
    rootFolderId: rootFolder.id,
    materiFolderId,
    laporanFolderId,
    backupFolderId,
  };
}

export async function autoBackupTeachingMaterialsAndReports(
  accessToken: string,
  teacherId: string,
  journalsData: any[],
  leavesData: any[]
): Promise<{ materiBackup: DriveFile; laporanBackup: DriveFile }> {
  const folders = await ensureAppFolderStructure(accessToken);

  const timestamp = new Date().toISOString().slice(0, 10);

  // 1. Backup Teaching Materials & Journals
  const journalsJson = JSON.stringify({ teacherId, date: timestamp, journals: journalsData }, null, 2);
  const journalsBlob = new Blob([journalsJson], { type: 'application/json' });
  const journalsFile = new File([journalsBlob], `Jurnal_Materi_${teacherId}_${timestamp}.json`, { type: 'application/json' });
  const materiBackup = await uploadDriveFile(accessToken, journalsFile, folders.materiFolderId);

  // 2. Backup Leave Reports & SK Status
  const leavesJson = JSON.stringify({ teacherId, date: timestamp, leaves: leavesData }, null, 2);
  const leavesBlob = new Blob([leavesJson], { type: 'application/json' });
  const leavesFile = new File([leavesBlob], `Laporan_Izin_${teacherId}_${timestamp}.json`, { type: 'application/json' });
  const laporanBackup = await uploadDriveFile(accessToken, leavesFile, folders.laporanFolderId);

  return { materiBackup, laporanBackup };
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gagal menghapus berkas (${res.status})`);
  }
}

export async function backupDataToDrive(accessToken: string, backupName: string, dataObj: any): Promise<DriveFile> {
  const jsonContent = JSON.stringify(dataObj, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const file = new File([blob], `${backupName}_${new Date().toISOString().slice(0,10)}.json`, { type: 'application/json' });
  return uploadDriveFile(accessToken, file);
}
