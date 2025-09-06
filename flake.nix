{
  description = "Python environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs?ref=nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    pyproject-nix.url = "github:pyproject-nix/pyproject.nix";
    uv2nix = {
      url = "github:pyproject-nix/uv2nix";
      inputs.pyproject-nix.follows = "pyproject-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pyproject-build-systems = {
      url = "github:pyproject-nix/build-system-pkgs";
      inputs.pyproject-nix.follows = "pyproject-nix";
      inputs.uv2nix.follows    = "uv2nix";
      inputs.nixpkgs.follows   = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, pyproject-nix, uv2nix, pyproject-build-systems, ... }:

  flake-utils.lib.eachDefaultSystem (system:
    let
      pkgs   = import nixpkgs { inherit system; };
      python = pkgs.python312;

      # 1. read the uv workspace rooted at the repo
      workspace = uv2nix.lib.workspace.loadWorkspace { workspaceRoot = ./.; };

      # 2. overlay: translate uv.lock → nix packages
      overlay = workspace.mkPyprojectOverlay {
        sourcePreference = "wheel";   # wheels succeed more often than sdists
      };

      # 3. compose the full python package set
      pythonSet =
        (pkgs.callPackage pyproject-nix.build.packages {
          inherit python;
          stdenv = pkgs.stdenv.override {
            targetPlatform = pkgs.stdenv.targetPlatform // {
              # Sets MacOS SDK version to 15.1 which implies Darwin version 24.
              # See https://en.wikipedia.org/wiki/MacOS_version_history#Releases for more background on version numbers.
              darwinSdkVersion = "15.3";
            };
          };
        })
        .overrideScope (pkgs.lib.composeManyExtensions [
          pyproject-build-systems.overlays.default
          overlay
          # put package-specific overrides here if a wheel is missing a system lib
          (final: prev: {
            python3Packages = prev.python3Packages // {
              torch = prev.python3Packages.torch.overridePythonAttrs (old: {
                nativeBuildInputs = (old.nativeBuildInputs or []) ++
                                 [ pkgs.autoPatchelfHook ];
              });
            };
          })
        ]);

      # 4. build a virtual-env with your “default” dependency group
      prodVenv =
        (pythonSet.mkVirtualEnv "prod-env" workspace.deps.default).overrideAttrs
          (old: {
            postFixup = (old.postFixup or "") + ''
              if [ -L "$out/env-vars" ] && [ "$(readlink "$out/env-vars")" = "env-vars" ]; then
                rm "$out/env-vars"
                printf "# env for %s\n" "$out" > "$out/env-vars"
              fi
            '';
          });
    in
    {
      ### ---------- Dev shells ----------
      devShells = {
        # A) network-friendly shell that lets uv mutate .venv
        impure = pkgs.mkShell {
          packages = [ python pkgs.uv ];
          shell = pkgs.writeShellScript "enter-zsh" ''
            #!/usr/bin/env bash
            # Run the mkShell hook then exec into your default shell as a login shell
            exec "${SHELL:-/bin/zsh}" -l
          '';

          env = {
            UV_PYTHON           = python.interpreter;  # force nixpkgs python
            UV_PYTHON_DOWNLOADS = "never";             # don’t auto-download cpython
            DYLD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
              pkgs.stdenv.cc.cc.lib
              pkgs.libz
              pkgs.glib
              pkgs.pango
              pkgs.fontconfig
              pkgs.cairo
              pkgs.gobject-introspection
              pkgs.gdk-pixbuf
              pkgs.harfbuzz
              pkgs.freetype
            ];
          };

          shellHook = "unset PYTHONPATH";
        };

      # B) fully reproducible shell powered by the store-built venv
        uv2nix = pkgs.mkShell {
          packages = [ prodVenv pkgs.uv ];

          env = {
            UV_NO_SYNC          = "1";                     # don’t rebuild venv
            UV_PYTHON           = "${prodVenv}/bin/python";
            UV_PYTHON_DOWNLOADS = "never";
          };

          shellHook = "unset PYTHONPATH";
        };
      };

      ### ---------- nix run / nix build targets ----------
      packages.${system}.default = prodVenv;

      apps.${system}.default = {
        type = "app";
        program = "${prodVenv}/bin/python";
      };
    });
}
