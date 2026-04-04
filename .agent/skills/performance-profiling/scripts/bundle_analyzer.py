#!/usr/bin/env python3
"""
Bundle Analyzer - Antigravity Kit
==================================
Analyzes JavaScript bundle size and identifies optimization opportunities.

Usage:
    python bundle_analyzer.py <project_path>
"""

import sys
import subprocess
import json
import os
from pathlib import Path
from datetime import datetime

class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    ENDC = '\033[0m'

BUDGET_THRESHOLDS = {
    'critical': 500 * 1024,  # 500KB
    'warning': 250 * 1024,   # 250KB
    'info': 100 * 1024,      # 100KB
}

def analyze_nextjs_bundle(project_path: Path) -> dict:
    """Analyze Next.js bundle size using built-in analyzer"""
    package_json = project_path / 'package.json'
    if not package_json.exists():
        return None

    with open(package_json) as f:
        pkg = json.load(f)

    deps = pkg.get('dependencies', {})
    if 'next' not in deps:
        return None

    issues = []
    warnings = []
    bundles = []

    try:
        result = subprocess.run(
            ['npm', 'run', 'build'],
            capture_output=True, text=True, timeout=300, cwd=project_path,
            env={**os.environ, 'ANALYZE': 'true'}
        )

        output = result.stdout + result.stderr

        for line in output.split('\n'):
            if 'kB' in line or 'KB' in line:
                bundles.append(line.strip())
    except subprocess.TimeoutExpired:
        warnings.append("Build timed out - consider running analyze manually with `ANALYZE=true npm run build`")
    except FileNotFoundError:
        warnings.append("npm not found")

    large_deps = []
    for dep, version in deps.items():
        if dep in ('@paypal/checkout-server-sdk', 'xlsx', 'jspdf', 'jspdf-autotable', 'recharts', '@google/genai'):
            large_deps.append(dep)

    if large_deps:
        warnings.append(f"Potentially large dependencies: {', '.join(large_deps)}")

    return {
        'type': 'nextjs',
        'bundles': bundles,
        'large_deps': large_deps,
        'issues': issues,
        'warnings': warnings,
        'total_deps': len(deps)
    }

def check_node_modules_size(project_path: Path) -> dict:
    """Check node_modules directory size"""
    node_modules = project_path / 'node_modules'
    if not node_modules.exists():
        return {'size_mb': 0, 'exists': False}

    try:
        result = subprocess.run(
            ['du', '-sh', str(node_modules)],
            capture_output=True, text=True, timeout=30
        )
        size_str = result.stdout.split()[0] if result.stdout else 'unknown'
        return {'size_mb': size_str, 'exists': True}
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {'size_mb': 'unknown', 'exists': True}

def main():
    if len(sys.argv) < 2:
        print("Usage: python bundle_analyzer.py <project_path>")
        sys.exit(1)

    project_path = Path(sys.argv[1]).resolve()
    if not project_path.exists():
        print(f"{Colors.RED}Path does not exist: {project_path}{Colors.ENDC}")
        sys.exit(1)

    print(f"{Colors.BOLD}{Colors.CYAN}Bundle Analysis{Colors.ENDC}")
    print(f"Project: {project_path}\n")

    nm_size = check_node_modules_size(project_path)
    if nm_size['exists']:
        print(f"node_modules size: {nm_size['size_mb']}")

    bundle_result = analyze_nextjs_bundle(project_path)

    all_issues = []
    all_warnings = []

    if bundle_result:
        print(f"\n{Colors.BOLD}Next.js Bundle:{Colors.ENDC}")
        print(f"  Total dependencies: {bundle_result['total_deps']}")

        if bundle_result['large_deps']:
            print(f"  Large dependencies: {', '.join(bundle_result['large_deps'])}")
            all_warnings.extend([f"Large: {dep}" for dep in bundle_result['large_deps']])

        if bundle_result['bundles']:
            print(f"\n  Bundle sizes:")
            for bundle in bundle_result['bundles'][:20]:
                print(f"    {bundle}")

        all_issues.extend(bundle_result['issues'])
        all_warnings.extend(bundle_result['warnings'])
    else:
        print(f"{Colors.YELLOW}Not a Next.js project or package.json not found{Colors.ENDC}")

    print(f"\n{Colors.BOLD}Summary:{Colors.ENDC}")
    print(f"  Issues: {len(all_issues)}")
    print(f"  Warnings: {len(all_warnings)}")

    if all_warnings:
        print(f"\n{Colors.YELLOW}Recommendations:{Colors.ENDC}")
        for w in all_warnings:
            print(f"  - {w}")

    sys.exit(0)

if __name__ == '__main__':
    main()
