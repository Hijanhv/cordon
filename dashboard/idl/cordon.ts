/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/cordon.json`.
 */
export type Cordon = {
  "address": "syCBdUmwQVcxUekupYBvPTM28HgCYN4pqehYaAktuik",
  "metadata": {
    "name": "cordon",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Cordon: on-chain policy and HITL firewall for Solana AI agents"
  },
  "instructions": [
    {
      "name": "approveTx",
      "discriminator": [
        218,
        193,
        99,
        162,
        223,
        82,
        12,
        184
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "rentReceiver",
          "writable": true
        },
        {
          "name": "agent",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_signer",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          },
          "relations": [
            "agent"
          ]
        },
        {
          "name": "pending",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "account",
                "path": "pending.nonce",
                "account": "pendingTx"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "registerAgent",
      "discriminator": [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "authority"
        },
        {
          "name": "agentSigner"
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agentSigner"
              }
            ]
          }
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maxLamportsPerTx",
          "type": "u64"
        },
        {
          "name": "hitlThresholdLamports",
          "type": "u64"
        },
        {
          "name": "dailyVolumeCeiling",
          "type": "u64"
        },
        {
          "name": "allowedPrograms",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    },
    {
      "name": "rejectTx",
      "discriminator": [
        94,
        166,
        49,
        237,
        254,
        58,
        38,
        13
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "rentReceiver",
          "writable": true
        },
        {
          "name": "agent",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_signer",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "pending",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "account",
                "path": "pending.nonce",
                "account": "pendingTx"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "reasonCode",
          "type": "u8"
        }
      ]
    },
    {
      "name": "setEnabled",
      "discriminator": [
        108,
        151,
        239,
        151,
        181,
        233,
        110,
        123
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_signer",
                "account": "agent"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "enabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setPolicy",
      "discriminator": [
        40,
        133,
        12,
        157,
        235,
        202,
        2,
        132
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.agent_signer",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          },
          "relations": [
            "agent"
          ]
        }
      ],
      "args": [
        {
          "name": "maxLamportsPerTx",
          "type": "u64"
        },
        {
          "name": "hitlThresholdLamports",
          "type": "u64"
        },
        {
          "name": "dailyVolumeCeiling",
          "type": "u64"
        },
        {
          "name": "allowedPrograms",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    },
    {
      "name": "submitAuto",
      "discriminator": [
        56,
        73,
        169,
        4,
        237,
        1,
        220,
        184
      ],
      "accounts": [
        {
          "name": "agentSigner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agentSigner"
              }
            ]
          }
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          },
          "relations": [
            "agent"
          ]
        }
      ],
      "args": [
        {
          "name": "txHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "lamports",
          "type": "u64"
        },
        {
          "name": "targetProgram",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "submitForReview",
      "discriminator": [
        199,
        53,
        35,
        67,
        50,
        36,
        231,
        83
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "agentSigner",
          "signer": true,
          "relations": [
            "agent"
          ]
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agentSigner"
              }
            ]
          }
        },
        {
          "name": "policy",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          },
          "relations": [
            "agent"
          ]
        },
        {
          "name": "pending",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              },
              {
                "kind": "account",
                "path": "agent.next_pending_nonce",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "txHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "lamports",
          "type": "u64"
        },
        {
          "name": "targetProgram",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agent",
      "discriminator": [
        47,
        166,
        112,
        147,
        155,
        197,
        86,
        7
      ]
    },
    {
      "name": "pendingTx",
      "discriminator": [
        130,
        17,
        1,
        13,
        211,
        54,
        53,
        49
      ]
    },
    {
      "name": "policy",
      "discriminator": [
        222,
        135,
        7,
        163,
        235,
        177,
        33,
        68
      ]
    }
  ],
  "events": [
    {
      "name": "agentEnabledChanged",
      "discriminator": [
        139,
        126,
        11,
        150,
        85,
        48,
        176,
        251
      ]
    },
    {
      "name": "agentRegistered",
      "discriminator": [
        191,
        78,
        217,
        54,
        232,
        100,
        189,
        85
      ]
    },
    {
      "name": "policyUpdated",
      "discriminator": [
        225,
        112,
        112,
        67,
        95,
        236,
        245,
        161
      ]
    },
    {
      "name": "txAutoApproved",
      "discriminator": [
        62,
        209,
        84,
        17,
        87,
        170,
        217,
        200
      ]
    },
    {
      "name": "txHumanApproved",
      "discriminator": [
        67,
        249,
        178,
        66,
        79,
        73,
        68,
        114
      ]
    },
    {
      "name": "txQueuedForReview",
      "discriminator": [
        203,
        250,
        165,
        206,
        171,
        176,
        178,
        65
      ]
    },
    {
      "name": "txRejected",
      "discriminator": [
        165,
        218,
        93,
        250,
        132,
        249,
        120,
        53
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "agentDisabled",
      "msg": "Agent is disabled by its authority"
    },
    {
      "code": 6001,
      "name": "overPerTxCap",
      "msg": "Transaction exceeds the per-transaction lamport cap"
    },
    {
      "code": 6002,
      "name": "programNotAllowed",
      "msg": "Target program is not in the allowlist"
    },
    {
      "code": 6003,
      "name": "overDailyVolume",
      "msg": "Transaction would exceed the rolling 24h volume ceiling"
    },
    {
      "code": 6004,
      "name": "invalidThresholdOrdering",
      "msg": "Policy must set hitl_threshold <= max_lamports_per_tx"
    },
    {
      "code": 6005,
      "name": "allowlistTooLong",
      "msg": "Allowed-programs list is over the size limit"
    },
    {
      "code": 6006,
      "name": "notPending",
      "msg": "Pending tx is not in the pending state"
    },
    {
      "code": 6007,
      "name": "pendingAgentMismatch",
      "msg": "Pending tx PDA does not match its agent"
    }
  ],
  "types": [
    {
      "name": "agent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentSigner",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "nextPendingNonce",
            "type": "u64"
          },
          {
            "name": "enabled",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "agentEnabledChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "enabled",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "agentRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pendingStatus",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "approved"
          },
          {
            "name": "rejected"
          }
        ]
      }
    },
    {
      "name": "pendingTx",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "txHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "lamports",
            "type": "u64"
          },
          {
            "name": "targetProgram",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "proposedAt",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "pendingStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "policy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "maxLamportsPerTx",
            "type": "u64"
          },
          {
            "name": "hitlThresholdLamports",
            "type": "u64"
          },
          {
            "name": "dailyVolumeCeiling",
            "type": "u64"
          },
          {
            "name": "volumeToday",
            "type": "u64"
          },
          {
            "name": "volumeWindowStart",
            "type": "i64"
          },
          {
            "name": "allowedPrograms",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "policyUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "maxLamportsPerTx",
            "type": "u64"
          },
          {
            "name": "hitlThresholdLamports",
            "type": "u64"
          },
          {
            "name": "dailyVolumeCeiling",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "txAutoApproved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "txHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "lamports",
            "type": "u64"
          },
          {
            "name": "targetProgram",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "txHumanApproved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "pending",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "txHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "txQueuedForReview",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "pending",
            "type": "pubkey"
          },
          {
            "name": "txHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "lamports",
            "type": "u64"
          },
          {
            "name": "targetProgram",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "txRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "pending",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "txHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reasonCode",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
