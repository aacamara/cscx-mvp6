import React from 'react';
import {
    Mail,
    Cloud,
    Target,
    LayoutGrid,
    Database,
    Linkedin,
    MessageSquare,
    FolderOpen,
    Network
} from 'lucide-react';

interface DataSource {
    id: string;
    name: string;
    dataType: string;
    connected: boolean;
    icon: React.ReactNode;
}

const dataSources: DataSource[] = [
    {
        id: 'gmail',
        name: 'Gmail',
        dataType: 'Email Communications',
        connected: true,
        icon: <Mail className="w-5 h-5" />
    },
    {
        id: 'salesforce',
        name: 'Salesforce',
        dataType: 'CRM & Pipeline',
        connected: true,
        icon: <Cloud className="w-5 h-5" />
    },
    {
        id: 'hubspot',
        name: 'HubSpot',
        dataType: 'Marketing Data',
        connected: false,
        icon: <Target className="w-5 h-5" />
    },
    {
        id: 'jira',
        name: 'Jira',
        dataType: 'Project Tickets',
        connected: true,
        icon: <LayoutGrid className="w-5 h-5" />
    },
    {
        id: 'internal-db',
        name: 'Internal Database',
        dataType: 'Company Records',
        connected: true,
        icon: <Database className="w-5 h-5" />
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        dataType: 'Professional Network',
        connected: false,
        icon: <Linkedin className="w-5 h-5" />
    },
    {
        id: 'slack',
        name: 'Slack',
        dataType: 'Team Communications',
        connected: false,
        icon: <MessageSquare className="w-5 h-5" />
    },
    {
        id: 'google-drive',
        name: 'Google Drive',
        dataType: 'Documents',
        connected: true,
        icon: <FolderOpen className="w-5 h-5" />
    }
];

const SourceCard: React.FC<{ source: DataSource }> = ({ source }) => {
    return (
        <div
            className={`
                relative p-4 rounded-lg border transition-all duration-300
                ${source.connected
                    ? 'bg-cscx-gray-900 border-cscx-gray-800 hover:border-cscx-accent/50 hover:shadow-accent-glow'
                    : 'bg-cscx-gray-900/50 border-cscx-gray-800/50 hover:border-cscx-gray-700'
                }
                group cursor-pointer
            `}
        >
            <div className="flex items-start justify-between mb-3">
                <div className={`
                    p-2 rounded-lg transition-colors
                    ${source.connected
                        ? 'bg-cscx-accent/10 text-cscx-accent'
                        : 'bg-cscx-gray-800 text-cscx-gray-400'
                    }
                `}>
                    {source.icon}
                </div>

                {/* Status indicator */}
                {source.connected ? (
                    <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cscx-success opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cscx-success"></span>
                        </span>
                        <span className="text-xs text-cscx-success font-medium">Live</span>
                    </div>
                ) : (
                    <button className="text-xs px-2 py-1 rounded bg-cscx-gray-800 text-cscx-gray-400 hover:bg-cscx-gray-700 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                        Connect
                    </button>
                )}
            </div>

            <h4 className={`font-semibold text-sm mb-1 ${source.connected ? 'text-white' : 'text-cscx-gray-400'}`}>
                {source.name}
            </h4>
            <p className="text-xs text-cscx-gray-500">
                {source.dataType}
            </p>

            {/* Subtle gradient overlay for connected sources */}
            {source.connected && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cscx-accent/5 to-transparent pointer-events-none" />
            )}
        </div>
    );
};

export const IntelligenceSources: React.FC = () => {
    const connectedCount = dataSources.filter(s => s.connected).length;
    const totalCount = dataSources.length;

    return (
        <div className="mt-6 p-5 bg-cscx-black border border-cscx-gray-800 rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cscx-accent/10">
                        <Network className="w-5 h-5 text-cscx-accent" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Intelligence Sources</h3>
                        <p className="text-xs text-cscx-gray-400">Connected platforms feeding real-time data</p>
                    </div>
                </div>
            </div>

            {/* Sources Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {dataSources.map(source => (
                    <SourceCard key={source.id} source={source} />
                ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-cscx-gray-800">
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                        {dataSources.filter(s => s.connected).slice(0, 4).map((source, i) => (
                            <div
                                key={source.id}
                                className="w-6 h-6 rounded-full bg-cscx-gray-800 border-2 border-cscx-black flex items-center justify-center"
                                style={{ zIndex: 4 - i }}
                            >
                                <span className="text-cscx-accent scale-75">{source.icon}</span>
                            </div>
                        ))}
                    </div>
                    <span className="text-sm text-cscx-gray-400">
                        <span className="text-cscx-accent font-semibold">{connectedCount}</span> of {totalCount} sources connected
                    </span>
                </div>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700 hover:text-white transition-colors">
                    Manage Sources
                </button>
            </div>
        </div>
    );
};
