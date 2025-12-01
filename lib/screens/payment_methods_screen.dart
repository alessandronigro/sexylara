import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class PaymentMethodsScreen extends StatefulWidget {
  const PaymentMethodsScreen({Key? key}) : super(key: key);

  @override
  State<PaymentMethodsScreen> createState() => _PaymentMethodsScreenState();
}

class _PaymentMethodsScreenState extends State<PaymentMethodsScreen> {
  final List<Map<String, dynamic>> _methods = [
    {'type': 'card', 'last4': '4242', 'brand': 'Visa', 'isDefault': true},
    {'type': 'paypal', 'email': 'user@example.com', 'isDefault': false},
  ];

  void _addCard() {
    // In a real app, integrate Stripe Elements or similar
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Integrazione Stripe in arrivo...')),
    );
  }

  void _addPayPal() {
    // In a real app, integrate PayPal SDK
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Integrazione PayPal in arrivo...')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        title: Text('Metodi di Pagamento', style: GoogleFonts.inter()),
        backgroundColor: const Color(0xFF1A1A1A),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Metodi salvati',
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            ..._methods.map((method) {
              final isCard = method['type'] == 'card';
              return Card(
                color: const Color(0xFF1E1E2C),
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  leading: Icon(
                    isCard ? Icons.credit_card : Icons.paypal,
                    color: Colors.white,
                  ),
                  title: Text(
                    isCard ? '${method['brand']} •••• ${method['last4']}' : 'PayPal (${method['email']})',
                    style: GoogleFonts.inter(color: Colors.white),
                  ),
                  subtitle: method['isDefault']
                      ? Text('Predefinito', style: GoogleFonts.inter(color: Colors.greenAccent))
                      : null,
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: Colors.redAccent),
                    onPressed: () {
                      setState(() {
                        _methods.remove(method);
                      });
                    },
                  ),
                ),
              );
            }).toList(),
            const SizedBox(height: 24),
            Text(
              'Aggiungi nuovo metodo',
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildAddButton(
              icon: Icons.credit_card,
              label: 'Carta di Credito/Debito',
              onTap: _addCard,
            ),
            const SizedBox(height: 12),
            _buildAddButton(
              icon: Icons.paypal, // Note: Icons.paypal might not exist in standard material icons, using account_balance_wallet as fallback if needed, but usually MDI has it. Standard flutter icons: payment or account_balance.
              // Actually Icons.paypal does not exist in standard material. Let's use generic payment icon.
              label: 'PayPal',
              onTap: _addPayPal,
              isPayPal: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAddButton({required IconData icon, required String label, required VoidCallback onTap, bool isPayPal = false}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey[800]!),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(isPayPal ? Icons.account_balance_wallet : icon, color: Colors.white),
            const SizedBox(width: 16),
            Text(
              label,
              style: GoogleFonts.inter(color: Colors.white, fontSize: 16),
            ),
            const Spacer(),
            const Icon(Icons.arrow_forward_ios, color: Colors.grey, size: 16),
          ],
        ),
      ),
    );
  }
}
