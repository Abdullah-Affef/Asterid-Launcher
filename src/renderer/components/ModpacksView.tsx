import { ModrinthBrowser } from './ModrinthBrowser';
import type { LauncherSettings } from '../types';

interface Props {
  settings: LauncherSettings | null;
  addLog: (msg: string) => void;
}

export function ModpacksView({ settings, addLog }: Props) {
  return (
    <ModrinthBrowser
      projectType="modpack"
      title="Modpacks"
      description="Browse and install modpacks from Modrinth"
      emptyIcon="▣"
      settings={settings}
      addLog={addLog}
    />
  );
}
