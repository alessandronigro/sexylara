import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:video_player/video_player.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:intl/intl.dart';
import 'dart:io';

import '../models/message.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final VoidCallback? onLongPress;

  const MessageBubble({super.key, required this.message, this.onLongPress});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onLongPress: onLongPress,
          child: Row(
            mainAxisAlignment: message.isUser
                ? MainAxisAlignment.end
                : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (message.isAssistant) ...[
                const CircleAvatar(
                  radius: 16,
                  backgroundColor: Colors.pinkAccent,
                  child: Icon(Icons.favorite, size: 16, color: Colors.white),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Column(
                  crossAxisAlignment: message.isUser
                      ? CrossAxisAlignment.end
                      : CrossAxisAlignment.start,
                  children: [
                    if (message.replyTo != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        margin: const EdgeInsets.only(bottom: 6),
                        decoration: BoxDecoration(
                          color: Colors.white10,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: message.replyTo!.role == 'user'
                              ? CrossAxisAlignment.end
                              : CrossAxisAlignment.start,
                          children: [
                            Text(
                              message.replyTo!.role == 'user' ? 'Tu' : 'Lara',
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              message.replyTo!.content,
                              style: const TextStyle(
                                  color: Colors.white60, fontSize: 13),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: message.isUser
                            ? Colors.pinkAccent
                            : Colors.grey[800],
                        borderRadius: BorderRadius.only(
                          topLeft: const Radius.circular(16),
                          topRight: const Radius.circular(16),
                          bottomLeft: Radius.circular(message.isUser ? 16 : 4),
                          bottomRight: Radius.circular(message.isUser ? 4 : 16),
                        ),
                      ),
                      child: _buildMessageContent(),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat('HH:mm').format(message.timestamp),
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              if (message.isUser) const SizedBox(width: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMessageContent() {
    switch (message.type) {
      case MessageType.text:
      case MessageType.typing:
        return Text(
          message.content,
          style: const TextStyle(color: Colors.white, fontSize: 15),
        );
      case MessageType.image:
        return _ImageMessage(url: message.content);
      case MessageType.video:
        return _VideoMessage(url: message.content);
      case MessageType.audio:
        return _AudioMessage(url: message.content);
    }
  }
}

class _ImageMessage extends StatelessWidget {
  final String url;

  const _ImageMessage({required this.url});

  @override
  Widget build(BuildContext context) {
    final isNetwork = url.startsWith('http');
    final imageProvider = isNetwork
        ? CachedNetworkImageProvider(url)
        : FileImage(File(url)) as ImageProvider;

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => _FullScreenImage(url: url, isNetwork: isNetwork),
          ),
        );
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: isNetwork
            ? CachedNetworkImage(
                imageUrl: url,
                width: 200,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  width: 200,
                  height: 200,
                  color: Colors.grey[700],
                  child: const Center(
                    child: CircularProgressIndicator(color: Colors.pinkAccent),
                  ),
                ),
                errorWidget: (context, url, error) => Container(
                  width: 200,
                  height: 200,
                  color: Colors.grey[700],
                  child: const Icon(Icons.error, color: Colors.red),
                ),
              )
            : Image.file(
                File(url),
                width: 200,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Container(
                  width: 200,
                  height: 200,
                  color: Colors.grey[700],
                  child: const Icon(Icons.error, color: Colors.red),
                ),
              ),
      ),
    );
  }
}

class _FullScreenImage extends StatelessWidget {
  final String url;
  final bool isNetwork;

  const _FullScreenImage({required this.url, this.isNetwork = true});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Center(
        child: InteractiveViewer(
          child: isNetwork
              ? CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.contain,
                )
              : Image.file(
                  File(url),
                  fit: BoxFit.contain,
                ),
        ),
      ),
    );
  }
}

class _VideoMessage extends StatefulWidget {
  final String url;

  const _VideoMessage({required this.url});

  @override
  State<_VideoMessage> createState() => _VideoMessageState();
}

class _VideoMessageState extends State<_VideoMessage> {
  late VideoPlayerController _controller;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url))
      ..initialize().then((_) {
        setState(() {
          _initialized = true;
        });
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized) {
      return Container(
        width: 200,
        height: 200,
        color: Colors.grey[700],
        child: const Center(
          child: CircularProgressIndicator(color: Colors.pinkAccent),
        ),
      );
    }

    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: AspectRatio(
            aspectRatio: _controller.value.aspectRatio,
            child: VideoPlayer(_controller),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              icon: Icon(
                _controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
                color: Colors.white,
              ),
              onPressed: () {
                setState(() {
                  _controller.value.isPlaying
                      ? _controller.pause()
                      : _controller.play();
                });
              },
            ),
          ],
        ),
      ],
    );
  }
}

class _AudioMessage extends StatefulWidget {
  final String url;

  const _AudioMessage({required this.url});

  @override
  State<_AudioMessage> createState() => _AudioMessageState();
}

class _AudioMessageState extends State<_AudioMessage> {
  final AudioPlayer _player = AudioPlayer();
  bool _isPlaying = false;
  Duration _duration = Duration.zero;
  Duration _position = Duration.zero;

  @override
  void initState() {
    super.initState();
    _player.setSourceUrl(widget.url);

    _player.onDurationChanged.listen((duration) {
      setState(() {
        _duration = duration;
      });
    });

    _player.onPositionChanged.listen((position) {
      setState(() {
        _position = position;
      });
    });

    _player.onPlayerStateChanged.listen((state) {
      setState(() {
        _isPlaying = state == PlayerState.playing;
      });
    });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 250,
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          IconButton(
            icon: Icon(
              _isPlaying ? Icons.pause : Icons.play_arrow,
              color: Colors.white,
            ),
            onPressed: () {
              if (_isPlaying) {
                _player.pause();
              } else {
                _player.play(UrlSource(widget.url));
              }
            },
          ),
          Expanded(
            child: Column(
              children: [
                LinearProgressIndicator(
                  value: _duration.inMilliseconds > 0
                      ? _position.inMilliseconds / _duration.inMilliseconds
                      : 0,
                  backgroundColor: Colors.grey[600],
                  valueColor:
                      const AlwaysStoppedAnimation<Color>(Colors.pinkAccent),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _formatDuration(_position),
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    Text(
                      _formatDuration(_duration),
                      style:
                          const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes.remainder(60));
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }
}

class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 16,
            backgroundColor: Colors.pinkAccent,
            child: Icon(Icons.favorite, size: 16, color: Colors.white),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey[800],
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: List.generate(3, (index) {
                return AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    final delay = index * 0.2;
                    final value = (_controller.value - delay).clamp(0.0, 1.0);
                    final opacity = (value * 2).clamp(0.3, 1.0);
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(opacity),
                          shape: BoxShape.circle,
                        ),
                      ),
                    );
                  },
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}
