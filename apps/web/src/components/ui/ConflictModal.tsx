import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Check, Sparkles, Clock, MapPin } from 'lucide-react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { Badge } from './Badge.js';
import { ISchedulerViolation, ISlotSuggestion } from '@schedulai/shared-types';
import { apiClient } from '../../api/client.js';

export interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ISchedulerViolation[];
  suggestions: ISlotSuggestion[];
  onSelectSuggestion: (suggestion: ISlotSuggestion) => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  suggestions,
  onSelectSuggestion,
}) => {
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<{
    summary: string;
    rootCause: string;
    recommendedActions: string[];
  } | null>(null);

  const requestAiExplanation = async () => {
    if (conflicts.length === 0) return;
    setIsExplaining(true);
    try {
      const first = conflicts[0];
      const res = await apiClient.post<{
        success: boolean;
        data: { summary: string; rootCause: string; recommendedActions: string[] };
      }>('/ai/explain-conflict', {
        conflict: {
          type: first.type,
          message: first.message,
          entityType: first.entityType,
        },
      });
      if (res.data.data) {
        setAiExplanation(res.data.data);
      }
    } catch {
      // Handled by UI
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Conflict Detected"
      description="The proposed move violates timetable hard constraints. Choose an alternative slot below."
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* Conflict Violations Alert */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Violated Hard Constraints ({conflicts.length})</span>
          </div>
          <ul className="space-y-1.5 text-xs text-rose-200">
            {conflicts.map((c, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-rose-400 font-mono mt-0.5">•</span>
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* AI Assistant Explanation Button & Card */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              AI Conflict Diagnostic
            </span>
            {!aiExplanation && (
              <Button
                variant="outline"
                size="sm"
                isLoading={isExplaining}
                onClick={requestAiExplanation}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-teal-400" />}
              >
                Explain with AI
              </Button>
            )}
          </div>

          {aiExplanation && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-950/30 p-4 space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-teal-300 font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>{aiExplanation.summary}</span>
              </div>
              <p className="text-xs text-slate-300">{aiExplanation.rootCause}</p>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-400">
                  Recommended Remedies:
                </div>
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  {aiExplanation.recommendedActions.map((act, i) => (
                    <li key={i}>{act}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Alternative Slots */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ranked Conflict-Free Alternatives ({suggestions.length})
          </div>

          {suggestions.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-center text-xs text-slate-400">
              No conflict-free alternative time slots found with current teacher availability and room capacity.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-teal-500/50 hover:bg-slate-800/40 transition group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="teal">{sug.timeSlot.day}</Badge>
                      <span className="flex items-center gap-1 text-xs text-slate-200 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {sug.timeSlot.startTime} – {sug.timeSlot.endTime} (Period {sug.timeSlot.periodNumber})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {sug.classroom.building} - {sug.classroom.roomNumber} ({sug.classroom.type})
                      </span>
                      <span>•</span>
                      <span className="text-emerald-400 text-[11px] font-medium">{sug.reason}</span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onSelectSuggestion(sug);
                      onClose();
                    }}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Select Slot
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Cancel Move
          </Button>
        </div>
      </div>
    </Modal>
  );
};
