'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useFontScale, type FontScale } from '@/components/providers/font-scale-provider';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { fontScale, setFontScale } = useFontScale();
  const [mounted, setMounted] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [recipeModel, setRecipeModel] = useState('');
  const [modelLoading, setModelLoading] = useState(true);
  const [imageModel, setImageModel] = useState('');
  const [imageModelLoading, setImageModelLoading] = useState(true);
  const [imagePromptTemplate, setImagePromptTemplate] = useState('');
  const [imagePromptLoading, setImagePromptLoading] = useState(true);
  const [imagePromptSaving, setImagePromptSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [apiKeys, setApiKeys] = useState<{ id: number; name: string; prefix: string }[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set mounted state for theme hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    fetch('/api/settings/model')
      .then(res => res.json())
      .then(data => {
        if (data.model) setRecipeModel(data.model);
      })
      .catch(console.error)
      .finally(() => setModelLoading(false));

    fetch('/api/settings/image-model')
      .then(res => res.json())
      .then(data => {
        if (data.model) setImageModel(data.model);
      })
      .catch(console.error)
      .finally(() => setImageModelLoading(false));

    fetch('/api/settings/image-prompt')
      .then(res => res.json())
      .then(data => {
        if (data.template) setImagePromptTemplate(data.template);
      })
      .catch(console.error)
      .finally(() => setImagePromptLoading(false));

    fetch('/api/auth/api-keys')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setApiKeys(data);
      })
      .catch(console.error)
      .finally(() => setApiKeysLoading(false));
  }, []);

  async function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newModel = e.target.value;
    setRecipeModel(newModel);

    try {
      const res = await fetch('/api/settings/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModel }),
      });

      if (res.ok) {
        toast.success('Modell aktualisiert');
      } else {
        toast.error('Fehler beim Speichern');
      }
    } catch {
      toast.error('Verbindungsfehler');
    }
  }

  async function handleImageModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newModel = e.target.value;
    setImageModel(newModel);

    try {
      const res = await fetch('/api/settings/image-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModel }),
      });

      if (res.ok) {
        toast.success('Bildmodell aktualisiert');
      } else {
        toast.error('Fehler beim Speichern');
      }
    } catch {
      toast.error('Verbindungsfehler');
    }
  }

  async function handleSaveImagePrompt() {
    setImagePromptSaving(true);
    try {
      const res = await fetch('/api/settings/image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: imagePromptTemplate }),
      });

      if (res.ok) {
        toast.success('Prompt-Vorlage gespeichert');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Fehler beim Speichern');
      }
    } catch {
      toast.error('Verbindungsfehler');
    } finally {
      setImagePromptSaving(false);
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();

    if (newPin.length < 4) {
      toast.error('PIN muss mindestens 4 Zeichen haben');
      return;
    }

    if (newPin !== confirmPin) {
      toast.error('PINs stimmen nicht überein');
      return;
    }

    setLoading(true);

    try {
      // First verify current PIN
      const verifyRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: currentPin }),
      });

      if (!verifyRes.ok) {
        toast.error('Aktueller PIN ist falsch');
        return;
      }

      // Then set new PIN (we need a new endpoint for this)
      const changeRes = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      });

      if (!changeRes.ok) {
        const data = await changeRes.json();
        toast.error(data.error || 'Fehler beim Ändern des PINs');
        return;
      }

      toast.success('PIN erfolgreich geändert');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch {
      toast.error('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Fehler beim Abmelden');
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleCreateApiKey() {
    if (!newKeyName.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    setCreatingKey(true);
    try {
      const res = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Fehler beim Erstellen');
        return;
      }

      const data = await res.json();
      setCreatedKey(data.key);
      setApiKeys(prev => [...prev, { id: prev.length, name: data.name, prefix: data.prefix }]);
      setNewKeyName('');
      setShowNewKeyForm(false);
      toast.success('API-Schlüssel erstellt');
    } catch {
      toast.error('Verbindungsfehler');
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleDeleteApiKey(id: number) {
    setDeletingKeyId(id);
    try {
      const res = await fetch(`/api/auth/api-keys/${id}`, { method: 'DELETE' });

      if (!res.ok) {
        toast.error('Fehler beim Löschen');
        return;
      }

      setApiKeys(prev => {
        const updated = prev.filter((_, i) => i !== id);
        return updated.map((k, i) => ({ ...k, id: i }));
      });
      toast.success('API-Schlüssel gelöscht');
    } catch {
      toast.error('Verbindungsfehler');
    } finally {
      setDeletingKeyId(null);
    }
  }

  async function handleCopyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      toast.success('Kopiert');
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) {
        toast.error('Fehler beim Exportieren');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rezepte-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export erfolgreich');
    } catch {
      toast.error('Verbindungsfehler');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Fehler beim Importieren');
        return;
      }

      const result = await res.json();
      toast.success(`${result.imported} Rezept(e) importiert, ${result.skipped} übersprungen`);
    } catch {
      toast.error('Ungültige Datei');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>KI-Modell Einstellungen</CardTitle>
            <CardDescription>
              Wähle das KI-Modell für die Rezept-Erkennung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="model">Modell</Label>
              <div className="relative">
                <select
                  id="model"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                  value={recipeModel}
                  onChange={handleModelChange}
                  disabled={modelLoading}
                >
                  <option value="openai/gpt-5.4">GPT-5.4</option>
                  <option value="google/gemini-3-pro">Google Gemini 3 Pro</option>
                  <option value="google/gemini-2.5-flash">Google Gemini 2.5 Flash</option>
                  <option value="anthropic/claude-4.5-sonnet">Anthropic Claude 4.5 Sonnet</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bildgenerierung</CardTitle>
            <CardDescription>
              Wähle das KI-Modell für die Bildgenerierung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="imageModel">Modell</Label>
                <div className="relative">
                  <select
                    id="imageModel"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                    value={imageModel}
                    onChange={handleImageModelChange}
                    disabled={imageModelLoading}
                  >
                    <option value="google/nano-banana">Nano Banana</option>
                    <option value="google/nano-banana-pro">Nano Banana Pro</option>
                    <option value="black-forest-labs/flux-schnell">FLUX Schnell</option>
                    <option value="bytedance/seedream-4">Seedream 4</option>
                    <option value="ideogram-ai/ideogram-v3-turbo">Ideogram v3 Turbo</option>
                    <option value="openai/gpt-image-1.5">GPT Image 1.5</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imagePrompt">Prompt-Vorlage</Label>
                <p className="text-xs text-muted-foreground">
                  Verwende <code className="bg-muted px-1 rounded">{'{title}'}</code> für den Rezepttitel und <code className="bg-muted px-1 rounded">{'{ingredients}'}</code> für die Zutatenliste.
                </p>
                <textarea
                  id="imagePrompt"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={imagePromptTemplate}
                  onChange={(e) => setImagePromptTemplate(e.target.value)}
                  disabled={imagePromptLoading}
                />
                <Button
                  onClick={handleSaveImagePrompt}
                  disabled={imagePromptSaving || imagePromptLoading}
                  size="sm"
                >
                  {imagePromptSaving ? 'Speichern...' : 'Vorlage speichern'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Darstellung</CardTitle>
            <CardDescription>
              Wähle das Erscheinungsbild der App
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="theme">Darstellung</Label>
              <div className="relative">
                <select
                  id="theme"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                  value={mounted ? theme : 'system'}
                  onChange={(e) => setTheme(e.target.value)}
                  disabled={!mounted}
                >
                  <option value="system">System</option>
                  <option value="light">Hell</option>
                  <option value="dark">Dunkel</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schriftgröße</CardTitle>
            <CardDescription>
              Passe die Textgröße an
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="fontScale">Größe</Label>
              <div className="relative">
                <select
                  id="fontScale"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                  value={mounted ? fontScale : '1'}
                  onChange={(e) => setFontScale(e.target.value as FontScale)}
                  disabled={!mounted}
                >
                  <option value="1">Normal (100%)</option>
                  <option value="1.1">Groß (110%)</option>
                  <option value="1.2">Sehr groß (120%)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PIN ändern</CardTitle>
            <CardDescription>
              Ändere den PIN für dein Familienkochbuch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPin">Aktueller PIN</Label>
                <Input
                  id="currentPin"
                  type="password"
                  inputMode="numeric"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPin">Neuer PIN</Label>
                <Input
                  id="newPin"
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  minLength={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPin">PIN bestätigen</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  minLength={4}
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Speichern...' : 'PIN ändern'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daten</CardTitle>
            <CardDescription>
              Exportiere oder importiere deine Rezepte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Button onClick={handleExport} disabled={exporting} variant="outline">
                {exporting ? 'Exportieren...' : 'Rezepte exportieren'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                variant="outline"
              >
                {importing ? 'Importieren...' : 'Rezepte importieren'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API-Schlüssel</CardTitle>
            <CardDescription>
              Erstelle API-Schlüssel für externen Zugriff auf deine Rezepte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {apiKeysLoading ? (
                <p className="text-sm text-muted-foreground">Laden...</p>
              ) : apiKeys.length === 0 && !createdKey ? (
                <p className="text-sm text-muted-foreground">Keine API-Schlüssel vorhanden</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key, index) => (
                    <div key={index} className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{key.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{key.prefix}...</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteApiKey(key.id)}
                        disabled={deletingKeyId === key.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingKeyId === key.id ? '...' : 'Löschen'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {createdKey && (
                <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-2">
                  <p className="text-sm font-medium">Neuer Schlüssel (nur einmal sichtbar):</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono break-all">{createdKey}</code>
                    <Button size="sm" variant="outline" onClick={() => handleCopyKey(createdKey)}>
                      Kopieren
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Beispiel:</p>
                    <code className="block text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                      {`curl -H "Authorization: Bearer ${createdKey}" ${window.location.origin}/api/recipes`}
                    </code>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setCreatedKey(null)} className="text-xs">
                    Ausblenden
                  </Button>
                </div>
              )}

              {showNewKeyForm ? (
                <div className="space-y-2">
                  <Label htmlFor="newKeyName">Name</Label>
                  <Input
                    id="newKeyName"
                    placeholder="z.B. Home Assistant"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateApiKey()}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateApiKey} disabled={creatingKey}>
                      {creatingKey ? 'Erstellen...' : 'Erstellen'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowNewKeyForm(false); setNewKeyName(''); }}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setShowNewKeyForm(true)}>
                  Neuer Schlüssel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abmelden</CardTitle>
            <CardDescription>
              Melde dich von diesem Gerät ab
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Abmelden...' : 'Abmelden'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Über</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Familienrezepte v1.0
            </p>
            <p className="text-sm text-muted-foreground">
              Dein digitales Familienkochbuch
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
