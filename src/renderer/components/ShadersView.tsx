import { ModrinthBrowser } from './ModrinthBrowser';
import type { LauncherSettings } from '../types';

interface Props {
  settings: LauncherSettings | null;
  addLog: (msg: string) => void;
}

export function ShadersView({ settings, addLog }: Props) {
  return (
    <ModrinthBrowser
      projectType="shader"
      title="Shaders"
      description="Browse and install shader packs from Modrinth"
      emptyIcon="✦"
      settings={settings}
      addLog={addLog}
    />
  );
}
