from flask import Flask, render_template, request, jsonify
import sys
import os

# Add current directory to path to import our optimizer
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from cash_cleaner_optimizer import (
    find_ideal_block_variants, 
    find_loose_bundle_variants,
    CURRENCIES,
    BUNDLE_SIZE,
    BLOCK_SIZE
)

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html', currencies=list(CURRENCIES.keys()))

@app.route('/optimize', methods=['POST'])
def optimize():
    try:
        data = request.get_json()
        amount = int(data.get('amount', 0))
        currency = data.get('currency', 'USD').upper()
        stock_data = data.get('stock', {})
        max_variants = int(data.get('max_variants', 5))
        
        # Validate inputs
        if amount <= 0:
            return jsonify({'error': 'Amount must be positive'}), 400
        
        if currency not in CURRENCIES:
            return jsonify({'error': f'Currency {currency} not supported'}), 400
        
        if amount % BUNDLE_SIZE != 0:
            return jsonify({'error': f'Amount must be divisible by {BUNDLE_SIZE}'}), 400
        
        # Convert stock data from strings to integers
        bundles_stock = {}
        if stock_data:
            for denom_str, qty_str in stock_data.items():
                try:
                    denom = int(denom_str)
                    qty = int(qty_str) if qty_str else 0
                    if qty > 0:
                        bundles_stock[denom] = qty
                except ValueError:
                    return jsonify({'error': f'Invalid stock data for denomination {denom_str}'}), 400
        
        # Try ideal blocks first
        ideal_variants = find_ideal_block_variants(
            amount, currency, max_variants, bundles_stock or None
        )
        
        result = {
            'success': True,
            'amount': amount,
            'currency': currency,
            'bundle_size': BUNDLE_SIZE,
            'block_size': BLOCK_SIZE,
            'has_ideal': len(ideal_variants) > 0,
            'variants': []
        }
        
        denoms = sorted(CURRENCIES[currency], reverse=True)
        
        if ideal_variants:
            # Format ideal variants
            for blocks, bundle_counts in ideal_variants:
                variant = {
                    'type': 'ideal',
                    'blocks': blocks,
                    'total_bundles': blocks * BLOCK_SIZE,
                    'breakdown': []
                }
                
                total_value = 0
                for i, (denom, count) in enumerate(zip(denoms, bundle_counts)):
                    if count > 0:
                        value = denom * count * BUNDLE_SIZE
                        total_value += value
                        variant['breakdown'].append({
                            'denomination': denom,
                            'bundles': count,
                            'value': value
                        })
                
                variant['total_value'] = total_value
                result['variants'].append(variant)
        else:
            # Try loose bundles fallback
            loose_variants = find_loose_bundle_variants(
                amount, currency, max_variants, bundles_stock or None
            )
            
            if loose_variants:
                result['has_ideal'] = False
                for bundle_counts in loose_variants:
                    variant = {
                        'type': 'loose',
                        'blocks': 0,
                        'total_bundles': sum(bundle_counts),
                        'breakdown': []
                    }
                    
                    total_value = 0
                    for i, (denom, count) in enumerate(zip(denoms, bundle_counts)):
                        if count > 0:
                            value = denom * count * BUNDLE_SIZE
                            total_value += value
                            variant['breakdown'].append({
                                'denomination': denom,
                                'bundles': count,
                                'value': value
                            })
                    
                    variant['total_value'] = total_value
                    result['variants'].append(variant)
            else:
                return jsonify({'error': 'Cannot fulfill order with given stock'}), 400
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/currencies')
def get_currencies():
    return jsonify({
        'currencies': {code: denoms for code, denoms in CURRENCIES.items()}
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 