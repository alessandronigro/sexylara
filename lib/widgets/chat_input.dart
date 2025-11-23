import 'package:flutter/material.dart';

class ChatInput extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSubmit;
  final bool isLoading;

  const ChatInput({
    super.key,
    required this.controller,
    required this.onSubmit,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            decoration: const InputDecoration(
              hintText: 'Scrivi qualcosa...',
            ),
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => onSubmit(),
          ),
        ),
        const SizedBox(width: 8),
        ElevatedButton(
          onPressed: isLoading ? null : onSubmit,
          child: isLoading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.send),
        ),
      ],
    );
  }
}
