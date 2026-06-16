import { ModrinthBrowser } from './ModrinthBrowser';
import type { LauncherSettings } from '../types';

interface Props {
  settings: LauncherSettings | null;
  addLog: (msg: string) => void;
}

export function ModsView({ settings, addLog }: Props) {
  return (
    <ModrinthBrowser
      projectType="mod"
      title="Mods"
      description="Browse and install mods from Modrinth"
      emptyIcon="⚡"
      settings={settings}
      addLog={addLog}
    />
  );
}
