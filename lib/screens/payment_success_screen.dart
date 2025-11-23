import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../providers/session_provider.dart';

import '../config.dart';

class PaymentSuccessScreen extends ConsumerStatefulWidget {
  final bool success;

  const PaymentSuccessScreen({super.key, this.success = false});

  @override
  ConsumerState<PaymentSuccessScreen> createState() => _PaymentSuccessScreenState();
}

class _PaymentSuccessScreenState extends ConsumerState<PaymentSuccessScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _payments = [];

  @override
  void initState() {
    super.initState();
    _loadPayments();
  }

  Future<void> _loadPayments() async {
    final userId = ref.read(sessionProvider).userId;
    if (userId == null) return;

    setState(() => _loading = true);
    try {
      final url = Uri.parse('${Config.apiBaseUrl}/api/payments/$userId');
      final response = await http.get(url);
      final data = jsonDecode(response.body) as List<dynamic>;
      setState(() {
        _payments = data.cast<Map<String, dynamic>>();
      });
    } catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Errore: $error')));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pagamenti')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.success)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('Pagamento completato con successo!'),
              ),
            const SizedBox(height: 12),
            const Text('Cronologia pagamenti', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _payments.isEmpty
                      ? const Center(child: Text('Nessun pagamento trovato.'))
                      : ListView.builder(
                          itemCount: _payments.length,
                          itemBuilder: (context, index) {
                            final payment = _payments[index];
                            final amount = (payment['amount'] as num?) ?? 0;
                            final credits = payment['credits'] ?? 0;
                            final status = payment['status'] ?? 'sconosciuto';
                            final created = payment['created_at'];
                            return Card(
                              child: ListTile(
                                title: Text('Crediti: $credits • €${(amount / 100).toStringAsFixed(2)}'),
                                subtitle: Text('Stato: $status'),
                                trailing: Text(created ?? ''),
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
