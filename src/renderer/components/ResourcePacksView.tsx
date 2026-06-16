import { ModrinthBrowser } from './ModrinthBrowser';
import type { LauncherSettings } from '../types';

interface Props {
  settings: LauncherSettings | null;
  addLog: (msg: string) => void;
}

export function ResourcePacksView({ settings, addLog }: Props) {
  return (
    <ModrinthBrowser
      projectType="resourcepack"
      title="Resource Packs"
      description="Browse and install resource packs from Modrinth"
      emptyIcon="◆"
      settings={settings}
      addLog={addLog}
    />
  );
}
