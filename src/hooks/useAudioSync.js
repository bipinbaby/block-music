import { useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../audio/AudioEngine';
import { useSequencerStore } from '../store/sequencerStore';

/**
 * Bridge between Zustand store and AudioEngine.
 * Watches blocks and syncs Tone.js nodes without coupling them architecturally.
 */
export function useAudioSync() {
  const blocks = useSequencerStore(s => s.blocks);
  const playbackState = useSequencerStore(s => s.playbackState);
  const bpm = useSequencerStore(s => s.bpm);
  const masterVolume = useSequencerStore(s => s.masterVolume);
  const totalColumns = useSequencerStore(s => s.totalColumns);

  const flashBlock = useSequencerStore(s => s.flashBlock);
  const unflashBlock = useSequencerStore(s => s.unflashBlock);
  const setCurrentStep = useSequencerStore(s => s.setCurrentStep);

  const prevPlaybackState = useRef('stopped');
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // Sync block voices
  useEffect(() => {
    (async () => {
      // Create or update voices for current blocks
      for (const block of blocks) {
        if (!audioEngine.hasVoice(block.id)) {
          await audioEngine.createVoice(block);
        } else {
          audioEngine.updateVoice(block);
        }
      }
      // Prune removed blocks
      audioEngine.pruneVoices(blocks.map(b => b.id));
    })();
  }, [blocks]);

  // Master volume
  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  // BPM
  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [bpm]);

  // Playback state changes
  useEffect(() => {
    const prev = prevPlaybackState.current;
    prevPlaybackState.current = playbackState;

    if (playbackState === 'playing' && prev !== 'playing') {
      const cols = totalColumns;

      const onStep = (step, time) => {
        // Get blocks at this step from the live ref (not stale closure)
        const currentBlocks = blocksRef.current.filter(b => b.column === step);
        currentBlocks.forEach(block => {
          audioEngine.triggerBlock(block.id, block.note, block.duration, time);
          // Visual flash — must happen via getDraw for sync
          Tone.getDraw().schedule(() => {
            flashBlock(block.id);
            setTimeout(() => unflashBlock(block.id), 300);
          }, time);
        });
        // Update playhead via getDraw so it's visually synced
        Tone.getDraw().schedule(() => {
          setCurrentStep(step);
        }, time);
      };

      audioEngine.startTransport(bpm, cols, onStep);

    } else if (playbackState === 'stopped') {
      audioEngine.stopTransport();
      setCurrentStep(0);

    } else if (playbackState === 'paused') {
      audioEngine.pauseTransport();
    }
  }, [playbackState]);
}
