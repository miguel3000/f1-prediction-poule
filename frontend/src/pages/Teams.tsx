const Teams = () => {
  const teams = [
    {
      name: 'McLaren',
      color: 'bg-orange-500',
      textColor: 'text-orange-400',
      borderColor: 'border-orange-500/50',
      engine: 'Mercedes',
      drivers: [
        { number: 4, name: 'Lando Norris', role: 'Race Driver' },
        { number: 81, name: 'Oscar Piastri', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Pato O\'Ward', role: 'Reserve Driver' },
        { name: 'Gabriel Fornaroli', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Ferrari',
      color: 'bg-red-600',
      textColor: 'text-red-500',
      borderColor: 'border-red-500/50',
      engine: 'Ferrari',
      drivers: [
        { number: 16, name: 'Charles Leclerc', role: 'Race Driver' },
        { number: 44, name: 'Lewis Hamilton', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Antonio Giovinazzi', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Red Bull Racing',
      color: 'bg-blue-700',
      textColor: 'text-blue-400',
      borderColor: 'border-blue-500/50',
      engine: 'Red Bull Powertrains',
      drivers: [
        { number: 1, name: 'Max Verstappen', role: 'Race Driver' },
        { number: 6, name: 'Isack Hadjar', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Yuki Tsunoda', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Mercedes',
      color: 'bg-teal-400',
      textColor: 'text-teal-400',
      borderColor: 'border-teal-400/50',
      engine: 'Mercedes',
      drivers: [
        { number: 63, name: 'George Russell', role: 'Race Driver' },
        { number: 12, name: 'Kimi Antonelli', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Frederik Vesti', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Aston Martin',
      color: 'bg-green-600',
      textColor: 'text-green-500',
      borderColor: 'border-green-500/50',
      engine: 'Honda',
      drivers: [
        { number: 14, name: 'Fernando Alonso', role: 'Race Driver' },
        { number: 18, name: 'Lance Stroll', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Jak Crawford', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Alpine',
      color: 'bg-pink-500',
      textColor: 'text-pink-400',
      borderColor: 'border-pink-500/50',
      engine: 'Renault',
      drivers: [
        { number: 10, name: 'Pierre Gasly', role: 'Race Driver' },
        { number: 43, name: 'Franco Colapinto', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Paul Aron', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Williams',
      color: 'bg-blue-500',
      textColor: 'text-blue-400',
      borderColor: 'border-blue-400/50',
      engine: 'Mercedes',
      drivers: [
        { number: 23, name: 'Alexander Albon', role: 'Race Driver' },
        { number: 55, name: 'Carlos Sainz', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Luke Browning', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Racing Bulls',
      color: 'bg-blue-900',
      textColor: 'text-blue-300',
      borderColor: 'border-blue-400/50',
      engine: 'Red Bull Powertrains',
      drivers: [
        { number: 30, name: 'Liam Lawson', role: 'Race Driver' },
        { number: 36, name: 'Arvid Lindblad', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Ayumu Iwasa', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Kick Sauber',
      color: 'bg-green-500',
      textColor: 'text-green-400',
      borderColor: 'border-green-400/50',
      engine: 'Ferrari',
      drivers: [
        { number: 27, name: 'Nico Hulkenberg', role: 'Race Driver' },
        { number: 5, name: 'Gabriel Bortoleto', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'TBA', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Haas F1 Team',
      color: 'bg-gray-100',
      textColor: 'text-gray-300',
      borderColor: 'border-gray-400/50',
      engine: 'Ferrari',
      drivers: [
        { number: 31, name: 'Esteban Ocon', role: 'Race Driver' },
        { number: 87, name: 'Oliver Bearman', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Ryo Hirakawa', role: 'Reserve Driver' },
      ],
    },
    {
      name: 'Cadillac F1 Team',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/50',
      engine: 'Ferrari',
      isNew: true,
      drivers: [
        { number: 11, name: 'Sergio Perez', role: 'Race Driver' },
        { number: 77, name: 'Valtteri Bottas', role: 'Race Driver' },
      ],
      reserves: [
        { name: 'Zhou Guanyu', role: 'Reserve Driver' },
        { name: 'Colton Herta', role: 'Test Driver' },
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-2 text-center text-gradient-red">
        2026 F1 Teams
      </h1>
      <p className="text-center text-f1-gray mb-8">
        11 Teams - 22 Race Drivers
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teams.map((team) => (
          <div
            key={team.name}
            className={`bg-f1-neutral-800 rounded-lg overflow-hidden border ${team.borderColor}`}
          >
            {/* Team Header */}
            <div className={`${team.color} px-5 py-3 flex items-center justify-between`}>
              <h2 className="text-xl font-bold text-white">{team.name}</h2>
              {team.isNew && (
                <span className="text-xs bg-white/20 px-2 py-1 rounded text-white font-semibold">
                  NEW IN 2026
                </span>
              )}
            </div>

            <div className="p-5">
              {/* Engine */}
              <div className="mb-4 text-sm">
                <span className="text-f1-gray">Power Unit: </span>
                <span className={team.textColor}>{team.engine}</span>
              </div>

              {/* Race Drivers */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-f1-gray mb-2 uppercase tracking-wide">
                  Race Drivers
                </h3>
                <div className="space-y-2">
                  {team.drivers.map((driver) => (
                    <div
                      key={driver.number}
                      className="flex items-center gap-3 bg-f1-neutral-700/50 rounded-lg p-3"
                    >
                      <span className={`text-2xl font-bold ${team.textColor} w-12 text-center`}>
                        #{driver.number}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{driver.name}</p>
                        <p className="text-xs text-f1-gray">{driver.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reserve Drivers */}
              {team.reserves && team.reserves.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-f1-gray mb-2 uppercase tracking-wide">
                    Reserve & Test Drivers
                  </h3>
                  <div className="space-y-2">
                    {team.reserves.map((driver, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-f1-neutral-700/30 rounded-lg p-2 border border-f1-neutral-700"
                      >
                        <span className="text-f1-gray text-sm w-12 text-center">-</span>
                        <div>
                          <p className="font-medium text-f1-gray">{driver.name}</p>
                          <p className="text-xs text-f1-gray/70">{driver.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-8 text-center text-sm text-f1-gray">
        <p>Driver lineup as of January 2026. Subject to change.</p>
        <p className="mt-2">
          Sources:{' '}
          <a
            href="https://www.formula1.com/en/teams"
            target="_blank"
            rel="noopener noreferrer"
            className="text-f1-red hover:underline"
          >
            Formula1.com
          </a>
          {' | '}
          <a
            href="https://www.the-race.com/formula-1/f1-2026-entry-list-driver-numbers-chassis-engines/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-f1-red hover:underline"
          >
            The Race
          </a>
        </p>
      </div>
    </div>
  );
};

export default Teams;
