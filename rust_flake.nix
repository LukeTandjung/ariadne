{
  description = "Nix Flake for CUDA C and Rust shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = inputs@{ self, nixpkgs }: let
    inherit (nixpkgs.lib) genAttrs;

    systems = nixpkgs.lib.systems.flakeExposed;
  in {
    devShells = genAttrs (systems) (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
        default = pkgs.mkShell {
          packages = with pkgs; [
            stdenv.cc.cc.lib
            rustc
            cargo
            rust-analyzer
            rustfmt
            clippy
          ];
        };
      }
    );
  };
}
