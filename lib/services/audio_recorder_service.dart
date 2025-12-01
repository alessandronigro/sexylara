import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:record/record.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:path_provider/path_provider.dart';

/// Service for recording audio from microphone
class AudioRecorderService {
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  String? _currentRecordingPath;

  bool get isRecording => _isRecording;
  String? get currentRecordingPath => _currentRecordingPath;

  /// Request microphone permission
  Future<bool> requestPermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  /// Check if microphone permission is granted
  Future<bool> hasPermission() async {
    final status = await Permission.microphone.status;
    return status.isGranted;
  }

  /// Start recording audio
  Future<bool> startRecording() async {
    try {
      // Check permission
      if (!await hasPermission() && !await requestPermission()) {
        debugPrint('❌ Microphone permission denied');
        return false;
      }

      // Get temporary directory
      final tempDir = await getTemporaryDirectory();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      _currentRecordingPath = '${tempDir.path}/audio_$timestamp.m4a';

      // Start recording
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
        ),
        path: _currentRecordingPath!,
      );

      _isRecording = true;
      debugPrint('🎤 Recording started: $_currentRecordingPath');
      return true;
    } catch (e) {
      debugPrint('❌ Error starting recording: $e');
      return false;
    }
  }

  /// Stop recording and return the file path
  Future<String?> stopRecording() async {
    try {
      if (!_isRecording) {
        debugPrint('⚠️ No recording in progress');
        return null;
      }

      final path = await _recorder.stop();
      _isRecording = false;

      if (path != null && await File(path).exists()) {
        debugPrint('✅ Recording stopped: $path');
        final file = File(path);
        final size = await file.length();
        debugPrint('📊 File size: ${(size / 1024).toStringAsFixed(2)} KB');
        return path;
      } else {
        debugPrint('❌ Recording file not found');
        return null;
      }
    } catch (e) {
      debugPrint('❌ Error stopping recording: $e');
      _isRecording = false;
      return null;
    }
  }

  /// Cancel recording without saving
  Future<void> cancelRecording() async {
    try {
      if (_isRecording) {
        await _recorder.stop();
        _isRecording = false;

        // Delete the file
        if (_currentRecordingPath != null) {
          final file = File(_currentRecordingPath!);
          if (await file.exists()) {
            await file.delete();
            debugPrint('🗑️ Recording cancelled and deleted');
          }
        }
      }
    } catch (e) {
      debugPrint('❌ Error cancelling recording: $e');
    }
  }

  /// Get recording duration (if supported)
  Future<Duration?> getRecordingDuration() async {
    try {
      if (_currentRecordingPath != null && await File(_currentRecordingPath!).exists()) {
        // This is a simple estimation based on file size
        // For accurate duration, you'd need to parse the audio file
        final file = File(_currentRecordingPath!);
        final size = await file.length();
        // Rough estimation: 128kbps = 16KB/s
        final seconds = (size / 16000).round();
        return Duration(seconds: seconds);
      }
    } catch (e) {
      debugPrint('❌ Error getting duration: $e');
    }
    return null;
  }

  /// Dispose resources
  void dispose() {
    _recorder.dispose();
  }
}
