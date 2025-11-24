import 'package:flutter/material.dart';
import 'dart:async';

/// Animated recording button widget
class RecordingButton extends StatefulWidget {
  final bool isRecording;
  final VoidCallback onStartRecording;
  final VoidCallback onStopRecording;
  final VoidCallback? onCancelRecording;

  const RecordingButton({
    Key? key,
    required this.isRecording,
    required this.onStartRecording,
    required this.onStopRecording,
    this.onCancelRecording,
  }) : super(key: key);

  @override
  State<RecordingButton> createState() => _RecordingButtonState();
}

class _RecordingButtonState extends State<RecordingButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  Timer? _recordingTimer;
  int _recordingSeconds = 0;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
  }

  @override
  void didUpdateWidget(RecordingButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isRecording && !oldWidget.isRecording) {
      _startTimer();
    } else if (!widget.isRecording && oldWidget.isRecording) {
      _stopTimer();
    }
  }

  void _startTimer() {
    _recordingSeconds = 0;
    _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _recordingSeconds++;
      });
    });
  }

  void _stopTimer() {
    _recordingTimer?.cancel();
    _recordingTimer = null;
    setState(() {
      _recordingSeconds = 0;
    });
  }

  String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _animationController.dispose();
    _recordingTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isRecording) {
      return Row(
        children: [
          // Cancel button
          IconButton(
            icon: const Icon(Icons.close, color: Colors.red),
            onPressed: widget.onCancelRecording,
          ),
          // Recording indicator
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.red.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  // Pulsing red dot
                  AnimatedBuilder(
                    animation: _animationController,
                    builder: (context, child) {
                      return Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.red.withOpacity(
                            0.5 + (_animationController.value * 0.5),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 12),
                  // Duration
                  Text(
                    _formatDuration(_recordingSeconds),
                    style: const TextStyle(
                      color: Colors.red,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  const Spacer(),
                  const Text(
                    'Registrando...',
                    style: TextStyle(
                      color: Colors.red,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Stop/Send button
          CircleAvatar(
            backgroundColor: Colors.red,
            child: IconButton(
              icon: const Icon(Icons.send, color: Colors.white),
              onPressed: widget.onStopRecording,
            ),
          ),
        ],
      );
    }

    // Normal mic button
    return IconButton(
      icon: const Icon(Icons.mic, color: Colors.pinkAccent),
      onPressed: widget.onStartRecording,
      tooltip: 'Registra audio',
    );
  }
}
