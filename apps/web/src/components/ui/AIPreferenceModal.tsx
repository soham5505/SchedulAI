import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight, Lightbulb } from 'lucide-react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { Badge } from './Badge.js';
import { IAIParsedPreference } from '@schedulai/shared-types';
import { apiClient } from '../../api/client.js';
import { useToast } from '../../contexts/ToastContext.js';

export interface AIPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreferences: (prefs: IAIParsedPreference[]) => void;
}

export const AIPreferenceModal: React.FC<AIPreferenceModalProps> = ({
  isOpen,
  onClose,
  onApplyPreferences,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<{
    preferences: IAIParsedPreference[];
    summary: string;
  } | null>(null);
  const toast = useToast();

  const handleParse = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { preferences: IAIParsedPreference[]; summary: string };
      }>('/ai/preferences', { prompt });

      if (res.data.data) {
        setParsedResult(res.data.data);
      }
    } catch (err) {
      toast.error((err as Error).message, 'AI Parsing Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (parsedResult && parsedResult.preferences.length > 0) {
      onApplyPreferences(parsedResult.preferences);
      toast.success(`Applied ${parsedResult.preferences.length} AI preference rules!`);
      onClose();
    }
  };

  const examplePrompts = [
    'Do not schedule Dr. Alan Turing before 10 AM on Mondays and Tuesdays',
    'Avoid scheduling Friday afternoon lectures for 3rd semester CS',
    'Prefer consecutive lab periods for Data Structures laboratory',
    'Balance professor workload evenly across all 5 weekdays',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Scheduling Preference Assistant"
      description="Type scheduling rules in plain English. The AI will convert them into structured mathematical optimization weights."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Input Bar */}
        <div className="space-y-2">
          <div className="relative">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Do not schedule Dr. Alan Turing before 10 AM, and avoid Friday afternoon classes for CSE Section A..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none transition"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Powered by SchedulAI NLP Engine</span>
            <Button
              variant="teal"
              size="sm"
              isLoading={isLoading}
              disabled={!prompt.trim()}
              onClick={handleParse}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Parse Preferences
            </Button>
          </div>
        </div>

        {/* Quick Example Prompts */}
        {!parsedResult && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Example Prompts to Try:</span>
            </div>
            <div className="space-y-1.5">
              {examplePrompts.map((eg, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(eg)}
                  className="block w-full text-left text-xs text-slate-400 hover:text-teal-300 hover:bg-slate-800/40 p-1.5 rounded-lg transition"
                >
                  "{eg}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Parsed Result Preview */}
        {parsedResult && (
          <div className="space-y-3 pt-2 border-t border-slate-800 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Extracted Constraints ({parsedResult.preferences.length})
              </span>
              <Badge variant="teal">{parsedResult.summary}</Badge>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {parsedResult.preferences.map((pref, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between p-3 rounded-xl border border-teal-500/20 bg-teal-950/20 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="teal">{pref.type}</Badge>
                      {pref.targetName && <span className="font-semibold text-slate-200">{pref.targetName}</span>}
                    </div>
                    <p className="text-slate-300">{pref.description}</p>
                    {pref.day && <span className="text-slate-400">Day: {pref.day}</span>}
                  </div>
                  <Badge variant="amber">Weight: {pref.weight || 5}/10</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {parsedResult && (
            <Button variant="primary" onClick={handleApply} leftIcon={<Check className="w-4 h-4" />}>
              Apply to Generator
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
