import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/credit_package.dart';
import '../providers/session_provider.dart';
import 'package:http/http.dart' as http;

import '../config.dart';

final _packages = [
  CreditPackage(id: 'base', name: 'Pacchetto Base', credits: 100, price: '€9.99'),
  CreditPackage(id: 'standard', name: 'Pacchetto Standard', credits: 500, price: '€24.99'),
  CreditPackage(id: 'premium', name: 'Pacchetto Premium', credits: 1000, price: '€39.99'),
];

class SubscriptionScreen extends ConsumerStatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  ConsumerState<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends ConsumerState<SubscriptionScreen> {
  String? _loadingPackage;

  Future<void> _startCheckout(CreditPackage pkg) async {
    final userId = ref.read(sessionProvider).userId;
    if (userId == null) return;

    setState(() => _loadingPackage = pkg.id);
    try {
      final url = Uri.parse('${Config.apiBaseUrl}/api/create-checkout-session');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'userid': userId, 'id': pkg.id}),
      );
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      final sessionId = payload['id'] as String?;

      if (sessionId != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sessione Stripe creata con successo.')),
        );
      } else {
        throw StateError('Sessione Stripe mancante');
      }
    } catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Errore checkout: $error')),
      );
    } finally {
      setState(() => _loadingPackage = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Acquista crediti')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: GridView.builder(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 1,
            childAspectRatio: 3 / 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
          ),
          itemCount: _packages.length,
          itemBuilder: (context, index) {
            final pkg = _packages[index];
            final loading = _loadingPackage == pkg.id;
            return Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(pkg.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text('${pkg.credits} crediti', style: const TextStyle(fontSize: 24, color: Colors.pink)),
                    const SizedBox(height: 8),
                    Text(pkg.price, style: const TextStyle(fontSize: 18)),
                    const Spacer(),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: loading ? null : () => _startCheckout(pkg),
                        child: loading
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Acquista ora'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
